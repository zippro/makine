// require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const supabase = createClient('https://lcysphtjcrhgopjrmjca.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM');

const TEMP_DIR = path.join('/tmp', 'rendi_worker');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);


function cleanup() {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_DIR);
}

const downloadFile = async (url, destPath) => {
    // OPTIMIZATION: Check if URL is local (Hetzner Storage)
    const localDomain = process.env.NEXT_PUBLIC_SERVER_IP ? `${process.env.NEXT_PUBLIC_SERVER_IP}.nip.io` : '46.62.209.244.nip.io';

    if (url && (url.includes(localDomain) || url.includes('localhost'))) {
        try {
            const urlObj = new URL(url);
            const localFilePath = path.join('/var/www', urlObj.pathname);

            if (fs.existsSync(localFilePath)) {
                console.log(`[Optimization] Copying local file: ${localFilePath}`);
                fs.copyFileSync(localFilePath, destPath);
                return;
            }
        } catch (e) {
            console.error(`[Optimization] Failed to read local file: ${e.message}`);
        }
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
};

async function processJob(job) {
    console.log(`\n--- Processing Job ${job.id} ---`);
    console.log(`Title: ${job.title_text}`);

    const jobId = job.id;
    let audioOutputLabel; // Scoped to this job to prevent leakage
    const workDir = path.join(TEMP_DIR, jobId);
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir);

    try {
        // 1. Update status to processing
        await supabase.from('video_jobs').update({ status: 'processing' }).eq('id', jobId);

        // 2. Fetch Music Details
        const { data: musicRel, error: musicError } = await supabase
            .from('video_music')
            .select(`
                order_index,
                music_library ( url, duration_seconds )
            `)
            .eq('video_job_id', jobId)
            .order('order_index');

        if (musicError) throw new Error('Failed to fetch music details: ' + musicError.message);

        const musicUrls = musicRel.map(m => m.music_library.url);
        const musicDurations = musicRel.map(m => m.music_library.duration_seconds || 0);
        console.log(`Audio Tracks: ${musicDurations.length}, Durations: [${musicDurations.join(', ')}], Total: ${musicDurations.reduce((a, b) => a + b, 0)} seconds`);

        // 3. Analyze Assets (Legacy vs New)
        // Backend now sends assets as an array of objects
        let timeline = [];
        let overlays = [];

        if (Array.isArray(job.assets)) {
            // New Format
            timeline = job.assets.filter(a => !a.is_overlay);
            overlays = job.assets.filter(a => a.is_overlay);
        } else {
            // Legacy / Fallback
            const assetsObj = job.assets || {};
            timeline = assetsObj.timeline || [];
            overlays = assetsObj.overlays || [];
        }

        // If timeline is empty but we have legacy fields, construct a single timeline item
        if (timeline.length === 0 && job.image_url) {
            timeline.push({
                type: 'video', // Assume video for legacy
                url: job.image_url,
                duration: null,
                loop: true
            });
        }

        const isAdvanced = timeline.length > 0;
        // Logic update: We treat everything as "Advanced" pipeline essentially, 
        // to support overlays on simple animations too.

        // 3a. Resolve Font (System or Custom)
        let fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf'; // Default default
        const fontName = (job.overlay_config?.title?.font) || 'Arial';

        console.log(`Resolving font: ${fontName}`);

        // Helper to find system font
        const findSystemFont = (candidates) => {
            for (const p of candidates) {
                if (fs.existsSync(p)) return p;
            }
            return null;
        };

        const systemMap = {
            'Arial': ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'],
            'Helvetica': ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf'],
            'Times New Roman': ['/System/Library/Fonts/Supplemental/Times New Roman.ttf', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'],
            'Georgia': ['/System/Library/Fonts/Supplemental/Georgia.ttf'],
            'Verdana': ['/System/Library/Fonts/Supplemental/Verdana.ttf'],
            'Impact': ['/Library/Fonts/Impact.ttf', '/usr/share/fonts/truetype/msttcorefonts/Impact.ttf']
        };

        // 1. Check Standard System Fonts
        if (systemMap[fontName]) {
            const found = findSystemFont(systemMap[fontName]);
            if (found) fontPath = found;
        } else {
            // 2. Check Custom Font in DB
            try {
                const { data: fontData, error: fontError } = await supabase
                    .from('project_fonts')
                    .select('url')
                    .eq('project_id', job.project_id)
                    .eq('name', fontName)
                    .single();

                if (fontData && fontData.url) {
                    console.log(`Found custom font URL: ${fontData.url}`);
                    const ext = path.extname(new URL(fontData.url).pathname) || '.ttf';
                    const localFontPath = path.join(workDir, `custom_font${ext}`);
                    await downloadFile(fontData.url, localFontPath);
                    if (fs.existsSync(localFontPath)) {
                        fontPath = localFontPath;
                    }
                } else {
                    console.warn(`Custom font '${fontName}' not found in DB.`);
                }
            } catch (e) {
                console.warn('Error resolving custom font:', e.message);
            }
        }

        // 3. Ultimate Fallback
        if (!fs.existsSync(fontPath)) {
            // Linux / Docker Environment Fallbacks
            const fallbackFonts = [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                '/System/Library/Fonts/Supplemental/Arial.ttf'
            ];

            let found = false;
            for (const p of fallbackFonts) {
                if (fs.existsSync(p)) {
                    fontPath = p;
                    found = true;
                    break;
                }
            }
            // ... (Deep search omitted to keep it fast, rely on known paths)
        }

        console.log('Using Font Path:', fontPath);

        // 3b. Download Video Assets
        console.log(isAdvanced ? `Downloading ${timeline.length} timeline assets...` : 'Downloading single asset...');

        const videoInputs = [];
        let totalVideoDuration = 0; // For timeline calculation

        if (isAdvanced) {
            // Advanced Mode: Download all timeline items
            for (let i = 0; i < timeline.length; i++) {
                const item = timeline[i];
                const itemPath = path.join(workDir, `input_video_${i}${path.extname(new URL(item.url).pathname) || '.mp4'}`);

                try {
                    await downloadFile(item.url, itemPath);
                    // Check size
                    if (fs.statSync(itemPath).size < 1000) throw new Error('File too small');

                    videoInputs.push({ path: itemPath, isVideo: item.type === 'video', duration: item.duration, loop: item.loop });
                } catch (e) {
                    throw new Error(`Failed to download timeline item ${i}: ${e.message}`);
                }
            }
        } else {
            // Legacy Mode
            let animationUrl = job.image_url;

            // Fix for Dynamic Homepage: If image_url is empty but animation_id exists, fetch it
            if (!animationUrl && job.animation_id) {
                console.log(`Fetching animation details for ID: ${job.animation_id}`);
                const { data: animData, error: animError } = await supabase
                    .from('animations')
                    .select('url')
                    .eq('id', job.animation_id)
                    .single();

                if (animError) {
                    console.error('Failed to fetch animation URL:', animError.message);
                } else if (animData) {
                    animationUrl = animData.url;
                    console.log('Resolved Animation URL:', animationUrl);
                }
            }

            if (!animationUrl) throw new Error('No image_url or animation_id provided');

            const videoPath = path.join(workDir, 'input_video.mp4');
            try {
                await downloadFile(animationUrl, videoPath);
                if (fs.statSync(videoPath).size < 1000) throw new Error('Video file too small (<1KB)');

                // Probe Duration
                let duration = 5;
                try {
                    const probeOut = require('child_process').execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`).toString();
                    const d = parseFloat(probeOut);
                    if (!isNaN(d) && d > 0) duration = d;
                    console.log(`Legacy Video Probed Duration: ${duration}`);
                } catch (e) {
                    console.warn('Failed to probe duration, defaulting to 5s:', e.message);
                }

                videoInputs.push({ path: videoPath, isVideo: true, duration: duration }); // Set probed duration
            } catch (e) {
                throw new Error(`Critical: Failed to load animation: ${e.message}`);
            }
        }

        // 3c. Download Audio Assets
        const musicPaths = [];
        for (let i = 0; i < musicUrls.length; i++) {
            const mPath = path.join(workDir, `input_audio_${i}.mp3`);
            try {
                if (!musicUrls[i]) continue;
                await downloadFile(musicUrls[i], mPath);
                const stats = fs.statSync(mPath);
                if (stats.size < 1000) {
                    console.warn(`Skipping Track ${i}: File too small.`);
                    continue;
                }
                musicPaths.push(mPath);
            } catch (e) {
                console.warn(`Skipping Track ${i}: ${e.message}`);
            }
        }

        if (musicPaths.length === 0) console.warn('Warning: No valid music tracks found. Video will be silent.');

        // 3c-2. PRE-CONCATENATE AUDIO INTO ONE CLEAN FILE
        // This is the new two-pass approach to fix all audio timestamp issues
        let preConcatAudioPath = null;
        if (musicPaths.length > 0) {
            preConcatAudioPath = path.join(workDir, 'audio_preconcat.aac');

            // Create concat list file for audio
            const audioConcatListPath = path.join(workDir, 'audio_concat.txt');
            let audioConcatContent = '';
            for (const mp of musicPaths) {
                audioConcatContent += `file '${mp}'\n`;
            }
            fs.writeFileSync(audioConcatListPath, audioConcatContent);
            console.log(`Audio Concat List:\n${audioConcatContent}`);

            // Run FFmpeg to pre-concat audio
            console.log('Pre-concatenating audio tracks into single file...');
            const preConcatArgs = [
                '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', audioConcatListPath,
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '44100',
                '-ac', '2',
                preConcatAudioPath
            ];

            await new Promise((resolve, reject) => {
                const proc = spawn('ffmpeg', preConcatArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
                let stderr = '';
                proc.stderr.on('data', (data) => { stderr += data.toString(); });
                proc.on('close', (code) => {
                    if (code === 0) {
                        console.log('Audio pre-concat complete!');
                        resolve();
                    } else {
                        console.error('Audio pre-concat failed:', stderr);
                        reject(new Error(`Audio pre-concat failed with code ${code}`));
                    }
                });
            });

            // Verify the pre-concat file
            const preConcatStats = fs.statSync(preConcatAudioPath);
            console.log(`Pre-concat audio file size: ${preConcatStats.size} bytes`);
        }

        // 3d. Download Overlay Images
        const overlayImagePaths = new Map(); // key: overlay index, value: path
        for (let i = 0; i < overlays.length; i++) {
            const ov = overlays[i];
            if (ov.type === 'image' && ov.url) {
                const ovPath = path.join(workDir, `overlay_image_${i}${path.extname(new URL(ov.url).pathname) || '.png'}`);
                try {
                    console.log(`Downloading Overlay ${i}: ${ov.url}`);
                    await downloadFile(ov.url, ovPath);
                    if (fs.statSync(ovPath).size < 100) {
                        console.warn(`Skipping Overlay ${i}: File too small.`);
                        continue;
                    }
                    overlayImagePaths.set(i, ovPath);
                } catch (e) {
                    console.warn(`Failed to download overlay ${i}: ${e.message}`);
                }
            }
        }

        // 4. Calculate Duration & Audio Loops EARLY
        let totalDuration = Math.round(musicDurations.reduce((sum, d) => sum + (d || 0), 0));
        console.log(`calculated totalDuration: ${totalDuration}`);
        if (totalDuration === 0) console.log('Music duration is 0, will use timeline duration.');

        // Calculate Audio Loops - set to 0 as placeholder, will be set to sequenceLoops after video loop calculation
        // Audio MUST loop the same number of times as video to cover the full duration
        let audioLoops = 1; // Will be updated after sequenceLoops is calculated
        console.log(`Audio Looping Strategy: Will match video sequence loops`);

        // 4b. Get Speed Multiplier Early
        const SpeedMult = job.speed_multiplier || 1;

        // 5. Sequence Looping Logic
        // We need to loop the *sequence* of timeline items to match totalDuration.
        // BUT, if we are slowing down the video (speed < 1), the video itself becomes longer.
        // So we need fewer loops to fill the time.
        // So we need fewer loops to fill the time.
        let timelineDuration = timeline.reduce((sum, item) => {
            let loops = 1;
            if (isAdvanced && item.loop_count) loops = item.loop_count;
            else if (job.default_loop_count) loops = job.default_loop_count; // Correct column name

            return sum + ((item.duration || 5) * loops);
        }, 0);
        if (timelineDuration === 0) timelineDuration = 5;

        // If no music duration (no music or 0s metadata), use video timeline duration
        if (totalDuration === 0) totalDuration = timelineDuration;

        // Effective duration of one sequence pass after speed adjustment
        const effectiveSequenceDuration = timelineDuration / SpeedMult;

        // How many times to repeat the whole sequence?
        // We compare Target Duration (Music) vs Effective Sequence Duration
        const sequenceLoops = Math.ceil(totalDuration / effectiveSequenceDuration);
        // Audio does NOT loop - the 7 tracks already total 25 min. Video loops to match.
        // audioLoops stays at 1 (one pass through all tracks)
        console.log(`Sequence Duration: ${timelineDuration}, Speed: ${SpeedMult}, Effective: ${effectiveSequenceDuration}, Target: ${totalDuration}, Video Loops: ${sequenceLoops}, Audio Loops: ${audioLoops}`);

        // Construct Flat Input List for Concat
        // We will reuse the same physical input files (videoInputs[i]), but refer to them multiple times in the filter graph?
        // No, ffmpeg concat filter takes stream labels. 
        // We have N video inputs. We can just repeat the stream labels in the concat list.
        // [0:v][1:v][0:v][1:v]... concat=n=4...

        // 5. Build Inputs using Concat Demuxer for Video Sequence
        // This avoids complex filter graph splitting for repeated inputs

        const concatFilePath = path.join(workDir, 'concat.txt');
        let concatContent = '';

        // Loop the sequence in the file list
        // New Logic: Respect individual asset loop_count
        for (let loop = 0; loop < sequenceLoops; loop++) {
            for (let i = 0; i < videoInputs.length; i++) {
                // Determine loop count for this asset
                let loopsForAsset = 1;
                if (isAdvanced && timeline[i] && timeline[i].loop_count) {
                    loopsForAsset = timeline[i].loop_count;
                } else if (job.default_loop_count) {
                    loopsForAsset = job.default_loop_count; // Correct column name
                }

                for (let k = 0; k < loopsForAsset; k++) {
                    // CRITICAL: Add inpoint 0 to reset timestamps for each segment
                    // This prevents Non-monotonic DTS errors when the same file appears multiple times
                    concatContent += `file '${videoInputs[i].path}'\n`;
                    concatContent += `inpoint 0\n`;
                }
            }
        }

        fs.writeFileSync(concatFilePath, concatContent);

        // Inputs:
        // [0] Concat List (Video Sequence)
        // [1..M] Audio Files
        // [M+1..P] Overlay Images

        const inputs = [
            `-f concat -safe 0 -i "${concatFilePath}"`,
            ...musicPaths.map(m => `-i "${m}"`),
            ...Array.from(overlayImagePaths.values()).map(p => `-loop 1 -t ${totalDuration} -i "${p}"`)
        ];

        let filterComplex = '';

        // --- 1. Audio Processing ---
        // NEW APPROACH: Use pre-concatenated audio file (created above)
        // This completely bypasses filter_complex for audio, avoiding all timestamp issues.
        // Audio is now a SINGLE clean input file.

        // No filter_complex needed for audio anymore!
        // We'll just add the pre-concat audio as a simple input and map it directly.

        // --- 2. Video Base Processing ---
        // Apply Speed and Trim if present in job
        const speed = job.speed_multiplier || 1;
        const trimStart = job.trim_start || 0;
        const trimEnd = job.trim_end || 0;

        let preFilter = '';
        if (trimEnd > 0) {
            preFilter += `trim=${trimStart}:${trimEnd},setpts=PTS-STARTPTS,`;
        } else if (trimStart > 0) {
            preFilter += `trim=${trimStart},setpts=PTS-STARTPTS,`;
        }



        // Speed Logic (setpts)
        // 0.5x speed = 2.0 * PTS (slower)
        // 2x speed = 0.5 * PTS (faster)
        if (speed !== 1) {
            preFilter += `setpts=PTS/${speed},`;
        }

        // --- Video Processing ---
        // Input [0:v] is now the fully looped sequence.
        // Scale to 1920x1080 (16:9) AND enforce 30fps to prevent blinking/resync issues with overlays
        const width = 1920;
        const height = 1080;

        // Force 30fps to ensure stable overlay timing
        // Insert preFilter before scaling
        // Note: Timestamp fixing is handled by -vsync cfr in output, not filter graph
        filterComplex += `[0:v]${preFilter}fps=30,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[vbase];`;

        let lastStream = '[vbase]';


        // --- 3. Audio Visualizer ---
        // If enabled, generate visualizer from audio and overlay it
        const visConfig = job.visualizer_config;
        if (visConfig && visConfig.enabled && preConcatAudioPath) {
            // Visualize Pipeline: [aout] -> [a_vis] -> filter -> [v_vis_gen]
            // Sanitize color: Use 0x format for FFmpeg
            let visColor = visConfig.color || 'white';
            if (visColor.startsWith('#')) {
                let hex = visColor.substring(1);
                if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                visColor = '0x' + hex;
            }

            const visPos = visConfig.position || 'bottom';
            const visH = 200; // Taller for spectrum
            const visW = width;

            // Split audio
            filterComplex += `[aout]asplit[a_vis][a_final];`;
            audioOutputLabel = '[a_final]';

            const visLabel = '[v_vis_gen]';

            // STYLES
            let visFilter = '';

            if (visConfig.style === 'spectrum') {
                // Spectrum (showcqt) - User Reference Style
                // Height constrained to 150px (approx 15% of 1080p) to avoid cutting video
                // bar_g=4 (gaps), full width
                // basefreq=40:endfreq=15000 (spreads bars better than default)
                visFilter = `showcqt=s=${visW}x150:fps=30:bar_g=4:axis=0:sono_h=0:count=60:fscale=log:basefreq=40:endfreq=15000`;
            } else if (visConfig.style === 'wave') {
                // Waveform - Smooth Line
                visFilter = `showwaves=s=${visW}x${visH}:mode=line:colors=${visColor}:rate=30`;
            } else if (visConfig.style === 'round') {
                // Circular (avectorscope)
                const dim = 500;
                visFilter = `avectorscope=s=${dim}x${dim}:rate=30:zoom=3:rc=255:gc=200:bc=200:draw=line`;
                // We might need to pad it to full width if we overlay simply
            } else if (visConfig.style === 'line') {
                // Simple Line (showfreqs)
                visFilter = `showfreqs=s=${visW}x${visH}:mode=line:colors=${visColor}:ascale=sqrt`;
            } else {
                // Bar (Default)
                // Use log scale for better visibility of lower volume
                visFilter = `showfreqs=s=${visW}x${visH}:mode=bar:colors=${visColor}:ascale=log`;
            }

            // Apply filter
            // format=rgba ensures alpha channel if filter supports it (showwaves does)
            if (visConfig.style === 'round') {
                // Special handling for round: it creates a square video. We need to overlay it specifically.
                // We might need to add colorkey to remove black background?
                // Reduce colorkey threshold to 0.03 to avoid eating dark edges
                filterComplex += `[a_vis]${visFilter},format=rgba,colorkey=0x000000:0.03:0.1[v_vis_gen_raw];`;
                // Pad to full width to make alignment easy? Or just overlay at coordinates.
                // Let's use it directly in overlay step.
                filterComplex += `[v_vis_gen_raw]scale=500:500${visLabel};`;
            } else {
                // Standard (Rectangular)
                // Add colorkey to ensure transparency (removes black background common in showcqt)
                // Reduce colorkey threshold to 0.03 to avoid eating dark edges
                filterComplex += `[a_vis]${visFilter},format=rgba,colorkey=0x000000:0.03:0.1[v_vis_gen];`;
            }

            // Overlay Logic
            const visOvLabel = '[v_vis_applied]';
            let overlayCmd = '';

            if (visConfig.style === 'round') {
                // Center check
                overlayCmd = `overlay=(W-w)/2:(H-h)/2` // Center screen
                if (visPos === 'bottom') overlayCmd = `overlay=(W-w)/2:H-h-50`;
                if (visPos === 'top') overlayCmd = `overlay=(W-w)/2:50`;
            } else {
                if (visPos === 'top') overlayCmd = `overlay=0:0`;
                else overlayCmd = `overlay=0:main_h-overlay_h`;
            }

            filterComplex += `${lastStream}${visLabel}${overlayCmd}${visOvLabel};`;
            lastStream = visOvLabel;

            console.log('Audio Visualizer Enabled:', visConfig.style, visColor);
        }

        // --- Overlays ---
        // Overlay Input Indices start AFTER Video (1 input) and Audio (1 pre-concat file)
        // Video is input 0, Audio is input 1, Overlays start at 2.
        const overlayInputBaseIndex = preConcatAudioPath ? 2 : 1;
        let currentOvImgIndex = 0;

        if (overlays.length > 0) {
            overlays.forEach((ov, idx) => {
                const nextLabel = `[vov${idx}]`;

                // Correct Position Logic
                const position = (ov.position || 'center').replace('_', '-');

                let x = '(w-text_w)/2';
                let y = '(h-text_h)/2';
                const p = 50;

                if (position === 'top-left') { x = `${p}`; y = `${p}`; }
                if (position === 'top-center') { x = '(w-text_w)/2'; y = `${p}`; }
                if (position === 'top-right') { x = `w-text_w-${p}`; y = `${p}`; }
                if (position === 'center') { x = '(w-text_w)/2'; y = '(h-text_h)/2'; }
                if (position === 'bottom-left') { x = `${p}`; y = `h-text_h-${p}`; }
                if (position === 'bottom-center') { x = '(w-text_w)/2'; y = `h-text_h-${p}`; }
                // Bottom-right with explicit padding
                if (position === 'bottom-right') { x = `w-text_w-${p}`; y = `h-text_h-${p}`; }

                // Timing
                const startTime = typeof ov.start_time === 'number' ? ov.start_time : 0;
                const duration = typeof ov.duration === 'number' ? ov.duration : 5;
                const endTime = startTime + duration;
                const enable = `between(t,${startTime},${endTime})`;

                // Extract Style (handle nested or top-level)
                const fontSize = ov.fontSize || (ov.style && ov.style.fontSize) || 60;
                const color = ov.color || (ov.style && ov.style.color) || 'white';

                if (ov.type === 'text') {
                    const safeText = (ov.content || '').replace(/'/g, "\\'").replace(/:/g, "\\:");
                    const boxStyle = (ov.style && ov.style.box_style) || 'standard';

                    // Base drawtext
                    let textFilter = `drawtext=fontfile='${fontPath}':text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}:enable='${enable}'`;

                    if (boxStyle === 'outline') {
                        // Strong Outline
                        textFilter += `:borderw=5:bordercolor=black`;
                    } else if (boxStyle === 'boxed') {
                        // Background Box
                        textFilter += `:borderw=2:bordercolor=black:box=1:boxcolor=black@0.5:boxborderw=20`;
                    } else if (boxStyle === 'neon') {
                        // Neon Glow - using shadow as approximation
                        textFilter += `:borderw=2:bordercolor=${color}:shadowcolor=${color}@0.9:shadowx=0:shadowy=0`;
                    } else if (boxStyle === 'clean') {
                        // No border, just text
                        // No extra args
                    } else {
                        // Standard (Shadow)
                        textFilter += `:shadowcolor=black@0.8:shadowx=2:shadowy=2`;
                    }

                    // Apply Fade if needed
                    const fade = ov.fade_duration || 0;
                    if (fade > 0) {
                        textFilter += `:alpha='if(lt(t,${startTime}+${fade}), (t-${startTime})/${fade}, if(lt(t,${endTime}-${fade}), 1, (${endTime}-t)/${fade}))'`;
                    }

                    filterComplex += `${lastStream}${textFilter}${nextLabel};`;
                    lastStream = nextLabel;

                } else if (ov.type === 'image' && overlayImagePaths.has(idx)) {
                    // ... (image logic)
                    const inputIdx = overlayInputBaseIndex + currentOvImgIndex;
                    currentOvImgIndex++;

                    // Replace text_w/text_h placeholders for image
                    let imgX = x.replace(/text_w/g, 'overlay_w_placeholder').replace(/\bw\b/g, 'W').replace(/overlay_w_placeholder/g, 'w');
                    let imgX2 = imgX.replace(/text_h/g, 'overlay_h_placeholder').replace(/\bh\b/g, 'H').replace(/overlay_h_placeholder/g, 'h');

                    let imgY = y.replace(/text_w/g, 'overlay_w_placeholder').replace(/\bw\b/g, 'W').replace(/overlay_w_placeholder/g, 'w');
                    let imgY2 = imgY.replace(/text_h/g, 'overlay_h_placeholder').replace(/\bh\b/g, 'H').replace(/overlay_h_placeholder/g, 'h');

                    const fade = ov.fade_duration || 0;
                    let imageLabel = `[${inputIdx}:v]`;

                    if (fade > 0) {
                        const fadedLabel = `[vovimg${idx}_faded]`;
                        filterComplex += `${imageLabel}format=rgba,fade=t=in:st=${startTime}:d=${fade}:alpha=1,fade=t=out:st=${endTime - fade}:d=${fade}:alpha=1${fadedLabel};`;
                        imageLabel = fadedLabel;
                    }

                    filterComplex += `${lastStream}${imageLabel}overlay=x=${imgX2}:y=${imgY2}:enable='${enable}'${nextLabel};`;
                    lastStream = nextLabel;
                }
            });
        } else if (!isAdvanced) {
            // Legacy Title Overlay
            const cleanTitle = (job.title_text || '').replace(/'/g, "'\\''");
            const nextLabel = '[vtitle]';
            filterComplex += `${lastStream}trim=0:${totalDuration},setpts=PTS-STARTPTS,drawtext=fontfile='${fontPath}':text='${cleanTitle}':fontsize=80:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2+150${nextLabel};`;
            lastStream = nextLabel;
        }

        // --- Audio (Already processed above) ---


        // --- Final Command ---
        const inputArgs = [];
        // Add inputs manually to args array
        // CRITICAL: -fflags +genpts regenerates all timestamps from scratch, preventing Non-monotonic DTS errors
        inputArgs.push('-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', concatFilePath);

        // Music Input - Single pre-concatenated audio file (NEW APPROACH)
        // Instead of adding N individual audio files and complex filter_complex,
        // we now use ONE pre-concatenated audio file with clean timestamps.
        if (preConcatAudioPath) {
            inputArgs.push('-i', preConcatAudioPath);
        }
        // Use the speed variable defined earlier (line 417) or re-read it but use a different name to avoid lint error
        const speedMult = job.speed_multiplier || 1;

        // FIX: If music determines duration, do NOT scale output duration by speed.
        // The speed change affects the Visual Content looping frequency, not the Final File Duration.
        // If no music, we assume 'totalDuration' refers to source content, so we scale it.
        const finalOutputDuration = (musicPaths.length > 0)
            ? totalDuration
            : (totalDuration / speedMult);

        Array.from(overlayImagePaths.values()).forEach(p => {
            inputArgs.push('-loop', '1', '-t', `${finalOutputDuration}`, '-i', p);
        });

        // Update output args to match speed-adjusted length
        // Note: filter_complex 'trim' usually works on source time, so we trim source THEN slow down.
        // But the output total duration limitation needs to match the SLOWED DOWN result.
        // We set -t on output to prevent hanging, but it must be the scaled duration.

        // Define audio map
        // NEW: Use direct input mapping (1:a) for pre-concatenated audio file
        // No filter_complex for audio means we map the audio input directly
        let audioMap = '1:a'; // Input 0 = video concat, Input 1 = pre-concat audio
        if (typeof audioOutputLabel !== 'undefined') {
            audioMap = audioOutputLabel; // Visualizer may override this
        }

        const outputPath = path.join(workDir, 'output.mp4');

        const outputArgs = [
            '-t', `${finalOutputDuration.toFixed(2)}`,
            '-vsync', 'cfr', // CRITICAL: Force constant frame rate, regenerating all timestamps
            '-map', lastStream,
            '-c:v', 'libx264',
            '-crf', '28',
            '-preset', 'ultrafast',
            '-movflags', '+faststart',
            outputPath
        ];

        // Only map audio if pre-concat audio exists
        if (preConcatAudioPath) {
            outputArgs.splice(2, 0, '-map', audioMap); // Insert after -t duration
            outputArgs.splice(outputArgs.length - 1, 0, '-c:a', 'copy'); // Copy audio codec (already AAC from pre-concat)
        }

        const ffmpegArgs = [
            '-y',
            ...inputArgs,
            '-filter_complex', filterComplex,
            ...outputArgs
        ];

        console.log('Running FFmpeg with spawn...');
        console.log('Args:', ffmpegArgs.join(' '));

        await new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            // Prevent deadlock by ignoring stdin/stdout (we only parse stderr)
            const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] });

            let lastProgressUpdate = 0;

            let stderrBuffer = [];
            const MAX_STDERR_LINES = 20;

            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                console.log('FF Log:', output); // DEBUG: Enable verbose logs

                // Store last N lines for debugging
                const lines = output.split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        stderrBuffer.push(line.trim());
                        if (stderrBuffer.length > MAX_STDERR_LINES) stderrBuffer.shift();
                    }
                });

                // Parse time=HH:MM:SS.mm
                const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                if (timeMatch) {
                    const hours = parseFloat(timeMatch[1]);
                    const minutes = parseFloat(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const currentTime = (hours * 3600) + (minutes * 60) + seconds;

                    const progress = Math.min(100, Math.round((currentTime / totalDuration) * 100));

                    // DEBUG PROGRESS
                    console.log(`[Progress Debug] Time: ${currentTime.toFixed(2)} / Total: ${totalDuration} | Progress: ${progress}%`);

                    // FORCE FINISH: If we are at the end (within 0.5s), force FFmpeg to stop
                    // This fixes the issue where FFmpeg hangs waiting for infinite audio loops even if video is done.
                    // SIGINT tells FFmpeg to "stop encoding and finalize file (write MOOV atom)".
                    if (currentTime >= totalDuration - 0.5) {
                        console.log('✅ Reached end of video duration. Sending SIGINT to finalize file...');
                        ffmpeg.kill('SIGINT');
                    }

                    // Update progress in DB (throttle every 2s)
                    const now = Date.now();
                    if (now - lastProgressUpdate > 2000 && progress > 0) {
                        lastProgressUpdate = now;
                        console.log(`Progress: ${progress}%`);
                        // Update video_jobs
                        supabase.from('video_jobs')
                            .update({ progress: progress, status: 'processing', updated_at: new Date().toISOString() })
                            .eq('id', jobId)
                            .then(({ error }) => {
                                if (error) console.error('Failed to update progress (video_jobs):', error.message);
                            });

                        // Update animations table too (so frontend sees it)
                        if (job.animation_id) { // Only update if linked to an animation
                            supabase.from('animations')
                                .update({ progress: progress, status: 'processing' })
                                .eq('id', job.animation_id)
                                .then(({ error }) => {
                                    if (error) console.error('Failed to update progress (animations):', error.message);
                                });
                        }
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                // Code 255 is SIGINT (Interrupted), which we send manually to force finish. Treat as success.
                if (code === 0 || code === 255) resolve();
                else {
                    const stderrLog = stderrBuffer.join('\n');
                    reject(new Error(`FFmpeg exited with code ${code}. Log:\n${stderrLog}`));
                }
            });

            ffmpeg.on('error', (err) => reject(err));
        });

        // 6. Save to Local Web Server (Hetzner Storage)
        console.log('Saving to local storage...');
        const publicDir = '/var/www/videos';
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

        const videoFileName = `${jobId}.mp4`;
        const publicPath = path.join(publicDir, videoFileName);

        fs.copyFileSync(outputPath, publicPath);

        // Construct Public URL
        // We expect NEXT_PUBLIC_SERVER_IP to be set in .env.local by deploy script
        const serverIp = process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244';
        // Use Hostname for SSL (nip.io)
        const hostname = `${serverIp}.nip.io`;
        const publicUrl = `https://${hostname}/videos/${videoFileName}`;

        console.log('File saved locally:', publicPath);
        console.log('Public URL:', publicUrl);

        // 6a. Generate Thumbnail
        const thumbFileName = `${jobId}_thumb.jpg`;
        const thumbPath = path.join(publicDir, thumbFileName);

        try {
            // Generate thumbnail at 10% or 1s, ensure we catch errors non-fatally
            execSync(`ffmpeg -y -i "${outputPath}" -ss 00:00:01 -vframes 1 "${thumbPath}"`, { stdio: 'ignore' });
        } catch (e) {
            console.warn('Thumbnail generation failed (1s), trying 0s:', e.message);
            try {
                execSync(`ffmpeg -y -i "${outputPath}" -ss 00:00:00 -vframes 1 "${thumbPath}"`, { stdio: 'ignore' });
            } catch (e2) {
                console.error('Thumbnail generation failed completely:', e2.message);
            }
        }

        const thumbUrl = fs.existsSync(thumbPath) ? `https://${hostname}/videos/${thumbFileName}` : null;

        // 7. Update Job Status
        const { error: finalUpdateError } = await supabase.from('video_jobs').update({
            status: 'done',
            video_url: publicUrl,
            thumbnail_url: thumbUrl,
            duration_seconds: finalOutputDuration // Correct scaled duration (Exact)
        }).eq('id', jobId);

        if (finalUpdateError) throw new Error('Final DB Update Failed: ' + finalUpdateError.message);

        // SYNC: If this job is linked to an Animation, update its video URL too
        if (job.animation_id) {
            console.log(`Updating linked animation ${job.animation_id}...`);
            await supabase.from('animations')
                .update({
                    url: publicUrl, // Update primary video URL
                    thumbnail_url: thumbUrl || undefined, // Update thumbnail if new one generated
                    duration: finalOutputDuration, // Update calculated duration (Exact)
                    updated_at: new Date().toISOString(),
                    status: 'done', // Mark as complete
                    error_message: null
                })
                .eq('id', job.animation_id);
        }

        // INCREMENT video_usage_count for used animations
        // Get the animation_id from the job
        if (job.animation_id) {
            console.log('Incrementing video_usage_count for animation:', job.animation_id);
            await supabase.rpc('increment_animation_usage', { animation_id: job.animation_id });
        }

        // INCREMENT video_usage_count for used music tracks
        // Get music IDs from job_music relation
        const { data: usedMusic } = await supabase
            .from('job_music')
            .select('music_id')
            .eq('job_id', jobId);

        if (usedMusic && usedMusic.length > 0) {
            console.log('Incrementing video_usage_count for', usedMusic.length, 'music tracks');
            for (const { music_id } of usedMusic) {
                await supabase.rpc('increment_music_usage', { music_id_input: music_id });
            }
        }

        console.log('Job Complete! Video URL:', publicUrl);

    } catch (err) {
        console.error('Job Failed:', err);
        await supabase.from('video_jobs').update({
            status: 'error',
            error_message: err.message
        }).eq('id', jobId);
    }
}


// Helper to fix missing thumbnails for animations generated by N8n
async function checkThumbnailGaps() {
    try {
        // Find one animation that is done but missing a thumbnail
        const { data: missing, error } = await supabase
            .from('animations')
            .select('id, url')
            .eq('status', 'done')
            .not('url', 'is', null)
            .is('thumbnail_url', null)
            .limit(1)
            .maybeSingle();

        if (error || !missing) return false;

        console.log(`[ThumbnailScanner] Found missing thumbnail for ${missing.id}`);

        const videoPath = path.join(TEMP_DIR, `${missing.id}_temp.mp4`);
        const thumbPath = path.join(TEMP_DIR, `${missing.id}_thumb.jpg`);

        // Download video
        console.log(`[ThumbnailScanner] Downloading: ${missing.url}`);
        await downloadFile(missing.url, videoPath);

        // Generate thumbnail
        console.log(`[ThumbnailScanner] Generating thumbnail...`);
        execSync(`ffmpeg -y -i "${videoPath}" -ss 00:00:01.000 -vframes 1 -q:v 2 "${thumbPath}"`, { stdio: 'ignore' });

        // Save from temp to public web dir
        const thumbFileName = `${missing.id}_thumb.jpg`;
        const publicDir = '/var/www/videos';
        const publicThumbPath = path.join(publicDir, thumbFileName);

        console.log(`[ThumbnailScanner] Saving to ${publicThumbPath}...`);
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        fs.copyFileSync(thumbPath, publicThumbPath);

        const serverIp = process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244';
        const thumbUrl = `https://${serverIp}.nip.io/videos/${thumbFileName}`;

        // Update DB
        const { error: updateError } = await supabase
            .from('animations')
            .update({ thumbnail_url: thumbUrl })
            .eq('id', missing.id);

        if (updateError) {
            console.error(`[ThumbnailScanner] Failed to update DB: ${updateError.message}`);
        } else {
            console.log(`[ThumbnailScanner] Thumbnail updated: ${thumbUrl}`);
        }

        // Cleanup
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

        return true; // We did work
    } catch (err) {
        console.error(`[ThumbnailScanner] Error: ${err.message}`);
        // Cleanup on error
        const cleanId = err.message.includes('missing') ? 'unknown' : 'temp';
        // Basic cleanup just in case, though tough to know ID here without scope. 
        // Reliance on next run or OS cleanup.
        return false;
    }
}

async function startWorker() {
    console.log('🚀 Local FFmpeg Worker Started');
    console.log('Waiting for jobs with status "queued"...');

    while (true) {
        try {
            const { data: jobs, error } = await supabase
                .from('video_jobs')
                .select('*')
                .eq('status', 'queued')
                .order('created_at', { ascending: true })
                .limit(1);

            if (error) {
                console.error('Polling error:', error.message);
            } else if (jobs && jobs.length > 0) {
                const candidate = jobs[0]; // Candidate job

                // ATOMIC CLAIM: Try to update status to 'processing' ONLY IF it is still 'queued'
                const { data: claimed, error: claimError } = await supabase
                    .from('video_jobs')
                    .update({ status: 'processing' }) // We will update more fields inside processJob, but this locks it.
                    .eq('id', candidate.id)
                    .eq('status', 'queued') // Crucial for race condition
                    .select();

                if (claimError) {
                    console.error('Claim error:', claimError.message);
                } else if (claimed && claimed.length > 0) {
                    // We successfully claimed it!
                    const job = claimed[0];

                    // SAFETY TIMEOUT: If a single job takes > 120 minutes, kill process so supervisor restarts it
                    const timeout = setTimeout(() => {
                        console.error('❌ CRITICAL: Job timed out (>120m). Exiting to force restart...');
                        process.exit(1);
                    }, 120 * 60 * 1000);

                    try {
                        await processJob(job);
                    } finally {
                        clearTimeout(timeout);
                    }
                } else {
                    console.log('⚠️ Job was picked up by another worker nearby. Skipping.');
                }
            } else {
                // No jobs in queue, use idle time to check for missing thumbnails
                await checkThumbnailGaps();
            }
        } catch (e) {
            console.error('Worker loop error:', e);
        }

        // Sleep 5s
        await new Promise(r => setTimeout(r, 5000));
    }
}

startWorker();
