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

        // 3a. Use System Font (Fallback for Linux/Mac)
        let fontPath = '/System/Library/Fonts/Supplemental/Georgia.ttf';
        if (!fs.existsSync(fontPath)) {
            // Fallback for Linux (Ubuntu/Debian)
            // Try DejaVuSans (common) or LiberationSans
            if (fs.existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')) {
                fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
            } else if (fs.existsSync('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf')) {
                fontPath = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
            } else {
                // Last resort: standard sans-serif (might depend on ffmpeg config, but usually explicitly needing a file)
                // We'll try a generic path often found in docker images
                fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
            }
        }
        console.log('Using Font:', fontPath);

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

        // FFmpeg Inputs:
        // [0..N-1] Video Files
        // [N..M] Audio Files
        // [M+1..P] Overlay Images

        // Fix: Video inputs should NOT be looped if we are concatenating them in sequence A-B-C-A-B-C
        // They should be single play.
        const inputs = [
            ...videoInputs.map(v => `-i "${v.path}"`), // Remove -loop 1/stream_loop, rely on filter graph repetition
            ...musicPaths.map(m => `-i "${m}"`),
            ...Array.from(overlayImagePaths.values()).map(p => `-loop 1 -t ${totalDuration} -i "${p}"`)
        ];

        let filterComplex = '';

        // --- Video Scaling & Preparation ---
        // We first scale ALL unique video inputs to [v0_scaled], [v1_scaled]...
        const width = 1920;
        const height = 1080;

        for (let i = 0; i < videoInputs.length; i++) {
            filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[v${i}_scaled];`;
        }

        // --- Sequence Concatenation ---
        let concatSegments = '';
        let segmentCount = 0;

        // Loop the sequence
        for (let loop = 0; loop < sequenceLoops; loop++) {
            for (let i = 0; i < videoInputs.length; i++) {
                concatSegments += `[v${i}_scaled]`;
                segmentCount++;

                // If we have enough duration, we could stop early, but complex to calc frame-perfectly here.
                // Simpler to loop fully and let -shortest (or explicit trim) cut the end.
            }
        }

        if (segmentCount > 1) {
            filterComplex += `${concatSegments}concat=n=${segmentCount}:v=1:a=0[vbase];`;
        } else {
            // Fallback if only 1 item 1 loop? (unlikely given logic above, but safe)
            filterComplex += `[v0_scaled]copy[vbase];`;
        }

        let lastStream = '[vbase]';

        // --- Overlays ---
        // Overlay Input Indices start AFTER Video and Audio inputs
        const overlayInputBaseIndex = videoInputs.length + musicPaths.length;
        let currentOvImgIndex = 0;

        if (overlays.length > 0) {
            overlays.forEach((ov, idx) => {
                const nextLabel = `[vov${idx}]`;

                // Correct Position Logic
                // Reference: top-left (0,0), bottom-right (W, H)
                let x = '(w-text_w)/2';
                let y = '(h-text_h)/2';

                // Padding
                const p = 50;

                if (ov.position === 'top-left') { x = `${p}`; y = `${p}`; }
                if (ov.position === 'top-center') { x = '(w-text_w)/2'; y = `${p}`; }
                if (ov.position === 'top-right') { x = `w-text_w-${p}`; y = `${p}`; }
                if (ov.position === 'center') { x = '(w-text_w)/2'; y = '(h-text_h)/2'; }
                if (ov.position === 'bottom-left') { x = `${p}`; y = `h-text_h-${p}`; }
                if (ov.position === 'bottom-center') { x = '(w-text_w)/2'; y = `h-text_h-150`; } // Higher for captions usually
                if (ov.position === 'bottom-right') { x = `w-text_w-${p}`; y = `h-text_h-${p}`; }

                // Timing
                const startTime = typeof ov.start_time === 'number' ? ov.start_time : 0;
                const duration = typeof ov.duration === 'number' ? ov.duration : 5;
                const endTime = startTime + duration;

                // Fade Logic
                const fadeDuration = 1;
                const alphaExpr = `if(lt(t,${startTime + fadeDuration}),(t-${startTime})/${fadeDuration},if(lt(t,${endTime - fadeDuration}),1,(${endTime}-t)/${fadeDuration}))`;
                const enable = `enable='between(t,${startTime},${endTime})'`;

                if (ov.type === 'text') {
                    const safeText = (ov.content || '').replace(/'/g, "\\'").replace(/:/g, "\\:");

                    // Basic Font Mapping (Attempts to respect choice or fallback)
                    let ovFontPath = fontPath; // Default fallback
                    // If user chose something specific, we trying to map (Verified paths on Hetzner/Linux)
                    // But for now, relying on the robust fallback we detected earlier is safest to avoid "file not found" crash.

                    filterComplex += `${lastStream}drawtext=fontfile='${ovFontPath}':text='${safeText}':fontsize=${ov.fontSize || 60}:fontcolor=${ov.color || 'white'}:borderw=2:bordercolor=black:x=${x}:y=${y}:alpha='${alphaExpr}':${enable}${nextLabel};`;
                    lastStream = nextLabel;
                } else if (ov.type === 'image' && overlayImagePaths.has(idx)) {
                    const inputIdx = overlayInputBaseIndex + currentOvImgIndex;
                    currentOvImgIndex++;
                    const ovFadedLabel = `[ovimgfade${idx}]`;

                    // Fade in/out on the input stream
                    filterComplex += `[${inputIdx}:v]fade=in:st=${startTime}:d=${fadeDuration}:alpha=1,fade=out:st=${endTime - fadeDuration}:d=${fadeDuration}:alpha=1${ovFadedLabel};`;

                    // Replace text_w/text_h with w/h for overlay sizing
                    let imgX = x.replace(/text_w/g, 'overlay_w_placeholder').replace(/\bw\b/g, 'W').replace(/overlay_w_placeholder/g, 'w');
                    let imgX2 = imgX.replace(/text_h/g, 'overlay_h_placeholder').replace(/\bh\b/g, 'H').replace(/overlay_h_placeholder/g, 'h');

                    let imgY = y.replace(/text_w/g, 'overlay_w_placeholder').replace(/\bw\b/g, 'W').replace(/overlay_w_placeholder/g, 'w');
                    let imgY2 = imgY.replace(/text_h/g, 'overlay_h_placeholder').replace(/\bh\b/g, 'H').replace(/overlay_h_placeholder/g, 'h');

                    filterComplex += `${lastStream}${ovFadedLabel}overlay=x=${imgX2}:y=${imgY2}:${enable}${nextLabel};`;
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

        // --- Audio ---
        // Audio Inputs are [videoInputs.length ... videoInputs.length + musicPaths.length - 1]
        const audioInputStart = videoInputs.length;
        const musicConcatInputs = musicPaths.map((_, i) => `[${audioInputStart + i}:a]`).join('');
        const musicConcat = musicPaths.length > 0
            ? `${musicConcatInputs}concat=n=${musicPaths.length}:v=0:a=1[aout]`
            : '';

        if (musicConcat) filterComplex += musicConcat;

        // --- Final Command ---
        const inputString = inputs.join(' ');
        const mapV = `-map "${lastStream}"`;
        const mapA = musicConcat ? `-map "[aout]"` : '';

        const outputPath = path.join(workDir, 'output.mp4');
        const command = `ffmpeg -y ${inputString} -filter_complex "${filterComplex}" ${mapV} ${mapA} -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k -movflags +faststart -shortest "${outputPath}"`;

        console.log('Running FFmpeg...');
        console.log('Command:', command);
        execSync(command, { stdio: 'inherit' });

        // 6. Upload
        console.log('Uploading output...');
        const fileBuffer = fs.readFileSync(outputPath);
        const fileName = `${job.project_id}/${jobId}/output.mp4`;
        const safeBucket = 'audio';
        const safePath = `videos/${jobId}_output.mp4`; // Using flat structure for safety

        const { error: upError } = await supabase.storage
            .from(safeBucket)
            .upload(safePath, fileBuffer, { contentType: 'video/mp4', upsert: true });

        if (upError) throw new Error('Upload failed: ' + upError.message);

        const { data: urlData } = supabase.storage.from(safeBucket).getPublicUrl(safePath);

        // 7. Update Job Status
        const { error: finalUpdateError } = await supabase.from('video_jobs').update({
            status: 'done',
            video_url: urlData.publicUrl,
            duration_seconds: totalDuration
        }).eq('id', jobId);

        if (finalUpdateError) throw new Error('Final DB Update Failed: ' + finalUpdateError.message);

        console.log('Job Complete! Video URL:', urlData.publicUrl);

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

                    // SAFETY TIMEOUT: If a single job takes > 20 minutes, kill process so supervisor restarts it
                    const timeout = setTimeout(() => {
                        console.error('❌ CRITICAL: Job timed out (>20m). Exiting to force restart...');
                        process.exit(1);
                    }, 20 * 60 * 1000);

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
