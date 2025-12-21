// require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const supabase = createClient('https://lcysphtjcrhgopjrmjca.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM');

const TEMP_DIR = path.join('/tmp', 'rendi_worker');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

async function downloadFile(url, destPath) {
    try {
        console.log(`Downloading: ${url}`);
        execSync(`curl -L -o "${destPath}" "${url}"`, { stdio: 'inherit' });
        if (!fs.existsSync(destPath)) throw new Error('Download failed: file missing');
    } catch (err) {
        throw new Error(`Failed to download ${url}: ${err.message}`);
    }
}

function cleanup() {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_DIR);
}

async function processJob(job) {
    console.log(`\n--- Processing Job ${job.id} ---`);
    console.log(`Title: ${job.title_text}`);

    const jobId = job.id;
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
                videoInputs.push({ path: videoPath, isVideo: true }); // Assume video for legacy
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

        // 4. Calculate Duration
        let totalDuration = Math.round(musicDurations.reduce((sum, d) => sum + (d || 0), 0));
        console.log(`calculated totalDuration: ${totalDuration}`);
        if (totalDuration === 0) totalDuration = 10;

        // 5. Sequence Looping Logic
        // We need to loop the *sequence* of timeline items to match totalDuration
        let timelineDuration = timeline.reduce((sum, item) => sum + (item.duration || 5), 0);
        if (timelineDuration === 0) timelineDuration = 5;

        // How many times to repeat the whole sequence?
        const sequenceLoops = Math.ceil(totalDuration / timelineDuration);
        console.log(`Sequence Duration: ${timelineDuration}, Target: ${totalDuration}, Loops: ${sequenceLoops}`);

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
                // If Advanced mode, check timeline for loop_count
                let loopsForAsset = 1;
                if (isAdvanced && timeline[i]) {
                    loopsForAsset = timeline[i].loop_count || 1;
                }

                for (let k = 0; k < loopsForAsset; k++) {
                    concatContent += `file '${videoInputs[i].path}'\n`;
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

        // --- 1. Audio Processing (Moved Up for Visualizer) ---
        const audioInputStart = 1; // Video concat is 0
        const musicConcatInputs = musicPaths.map((_, i) => `[${audioInputStart + i}:a]`).join('');
        const musicConcat = musicPaths.length > 0
            ? `${musicConcatInputs}concat=n=${musicPaths.length}:v=0:a=1[aout]`
            : '';

        if (musicConcat) {
            filterComplex += `${musicConcat};`;
        } else {
            // Silence generation if no music? Or just skip.
        }

        // --- 2. Video Base Processing ---

        // --- Video Processing ---
        // Input [0:v] is now the fully looped sequence.
        // Scale to 1920x1080 (16:9) AND enforce 30fps to prevent blinking/resync issues with overlays
        const width = 1920;
        const height = 1080;

        // Force 30fps to ensure stable overlay timing
        filterComplex += `[0:v]fps=30,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[vbase];`;

        let lastStream = '[vbase]';

        // --- 3. Audio Visualizer ---
        // If enabled, generate visualizer from audio and overlay it
        const visConfig = job.visualizer_config;
        if (visConfig && visConfig.enabled && musicConcat) {
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
        // Overlay Input Indices start AFTER Video (1 input) and Audio inputs
        // Video is input 0.
        const overlayInputBaseIndex = 1 + musicPaths.length;
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
        inputArgs.push('-f', 'concat', '-safe', '0', '-i', concatFilePath);
        musicPaths.forEach(m => inputArgs.push('-i', m));
        Array.from(overlayImagePaths.values()).forEach(p => {
            inputArgs.push('-loop', '1', '-t', `${totalDuration}`, '-i', p);
        });

        // Define audio map
        let audioMap = '[aout]';
        if (typeof audioOutputLabel !== 'undefined') {
            audioMap = audioOutputLabel;
        }

        const outputPath = path.join(workDir, 'output.mp4');

        const outputArgs = [
            '-map', lastStream,
            '-c:v', 'libx264',
            '-crf', '28',
            '-preset', 'fast',
            '-movflags', '+faststart',
            '-t', `${totalDuration}`, // HARD DURATION CAP
            outputPath
        ];

        // Only map audio if present
        if (musicPaths.length > 0) {
            outputArgs.splice(2, 0, '-map', audioMap); // Insert map after video map (index 2)
            outputArgs.splice(outputArgs.length - 3, 0, '-c:a', 'aac', '-b:a', '128k'); // Insert audio codec args before -t flag
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
            const ffmpeg = spawn('ffmpeg', ffmpegArgs);

            let lastProgressUpdate = 0;

            let stderrBuffer = [];
            const MAX_STDERR_LINES = 20;

            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                // console.log('FF Log:', output); // Verify verbosity doesn't flood logs

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

                    const now = Date.now();
                    if (now - lastProgressUpdate > 3000 && progress > 0) { // Update every 3s
                        lastProgressUpdate = now;
                        console.log(`Progress: ${progress}%`);
                        supabase.from('video_jobs')
                            .update({
                                progress: progress,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', jobId)
                            .then(({ error }) => {
                                if (error) console.error('Failed to update progress:', error.message);
                            });
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) resolve();
                else {
                    const stderrLog = stderrBuffer.join('\n');
                    reject(new Error(`FFmpeg exited with code ${code}. Log:\n${stderrLog}`));
                }
            });

            ffmpeg.on('error', (err) => reject(err));
        });

        // 6. Upload with Retry
        console.log('Uploading output...');
        const fileBuffer = fs.readFileSync(outputPath);
        const fileName = `${job.project_id}/${jobId}/output.mp4`;
        const safeBucket = 'audio';
        const safePath = `videos/${jobId}_output.mp4`;

        let uploadError = null;
        let publicUrl = '';

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`Upload attempt ${attempt}/3...`);
                const { error: upError } = await supabase.storage
                    .from(safeBucket)
                    .upload(safePath, fileBuffer, { contentType: 'video/mp4', upsert: true });

                if (upError) throw upError;

                const { data: urlData } = supabase.storage.from(safeBucket).getPublicUrl(safePath);
                publicUrl = urlData.publicUrl;
                uploadError = null;
                console.log('Upload successful!');
                break;
            } catch (err) {
                console.error(`Upload attempt ${attempt} failed:`, err.message);
                uploadError = err;
                if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt)); // Backoff
            }
        }

        if (uploadError) throw new Error('Upload failed after 3 attempts: ' + uploadError.message);

        // 7. Update Job Status
        const { error: finalUpdateError } = await supabase.from('video_jobs').update({
            status: 'done',
            video_url: publicUrl,
            duration_seconds: totalDuration
        }).eq('id', jobId);

        if (finalUpdateError) throw new Error('Final DB Update Failed: ' + finalUpdateError.message);

        console.log('Job Complete! Video URL:', publicUrl);

    } catch (err) {
        console.error('Job Failed:', err);
        await supabase.from('video_jobs').update({
            status: 'error',
            error_message: err.message
        }).eq('id', jobId);
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
            }
        } catch (e) {
            console.error('Worker loop error:', e);
        }

        // Sleep 5s
        await new Promise(r => setTimeout(r, 5000));
    }
}

startWorker();
