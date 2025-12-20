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

        // Loop count depends on video length vs audio length
        // This is complex for timeline. For now, we rely on -stream_loop on the CONCATENATED output or input
        const loopCount = Math.ceil(totalDuration / 10) + 1; // Rough estimate for single input

        // 5. Build FFmpeg Command
        // Inputs: [0..N] are Video inputs, [N+1..M] are Audio inputs
        const inputs = [
            ...videoInputs.map(v => {
                // Apply loop if requested (Simplistic support for single items or mapped inputs)
                // Note: -stream_loop must come BEFORE -i
                // -1 means infinite loop (ffmpeg limits it to output duration)
                const loopFlag = v.loop ? `-stream_loop ${loopCount}` : '';
                return `${loopFlag} -i "${v.path}"`;
            }),
            ...musicPaths.map(m => `-i "${m}"`),
            ...Array.from(overlayImagePaths.values()).map(p => `-loop 1 -t ${totalDuration} -i "${p}"`)
        ];

        let filterComplex = '';
        let videoMap = '[v]'; // Final video stream label

        // --- Video Processing ---
        // Concatenate Timeline
        let concatParts = '';

        // Normalize all inputs to same resolution/fps to allow concat
        // Scale to 1080x1920 (Shorts)
        const width = 1080;
        const height = 1920;

        for (let i = 0; i < videoInputs.length; i++) {
            const item = videoInputs[i];
            const inputLabel = `[${i}:v]`; // This input already has stream_loop applied if needed
            const scaledLabel = `[v${i}]`;

            // Scale filters
            filterComplex += `${inputLabel}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1${scaledLabel};`;

            // Should we trim it if it has a specific duration?
            // If item.duration is set and it's an image, stream_loop handles repetition but not duration cut?
            // Actually stream_loop repeats the input stream.
            // If it's a static image, -loop 1 is usually used for infinite stream, then -t to cut.
            // worker currently relies on stream_loop for video.
            // For images in slideshow, we might lack the -loop 1 or -t flags if we just downloaded the jpg.
            // But downloadFile saves it as jpg. ffmpeg -i image.jpg gives 1 frame.
            // stream_loop on 1 frame might not work as expected for "duration".
            // Ideally we need `loop=loop=${duration*fps}:size=1:start=0` filter or -loop 1 input option.

            concatParts += `${scaledLabel}`;
        }

        // Concat only if we have multiple parts, otherwise pass through
        // If single part, [v0] is our base.
        if (videoInputs.length > 1) {
            filterComplex += `${concatParts}concat=n=${videoInputs.length}:v=1:a=0[vbase];`;
            videoMap = '[vbase]';
        } else {
            videoMap = '[v0]';
        }

        // Re-construct inputs string 
        // We embedded stream_loop in the inputs array map above.
        let inputString = inputs.join(' ');


        // --- Overlays ---
        let lastStream = videoMap;
        if (isAdvanced && overlays.length > 0) {
            // Apply overlays
            // We need to strip brackets from lastStream for use inside filter chain?
            // No, `[vbase]drawtext...[vnext]`

            // Offset for overlay inputs in the ffmpeg input list
            // Video inputs + Music inputs
            let overlayInputOffset = videoInputs.length + musicPaths.length;
            let currentOvImgIndex = 0; // To track which Map entry corresponds to input index

            overlays.forEach((ov, idx) => {
                const nextLabel = `[vov${idx}]`;

                // Position logic
                let x = '(w-text_w)/2';
                let y = '(h-text_h)/2';

                if (ov.position === 'top-left') { x = '50'; y = '50'; }
                if (ov.position === 'top-center') { x = '(w-text_w)/2'; y = '50'; }
                if (ov.position === 'top-right') { x = 'w-text_w-50'; y = '50'; }
                if (ov.position === 'center') { x = '(w-text_w)/2'; y = '(h-text_h)/2'; }
                if (ov.position === 'bottom-center') { x = '(w-text_w)/2'; y = 'h-text_h-150'; }

                // Timing
                const startTime = typeof ov.start_time === 'number' ? ov.start_time :
                    typeof ov.startTime === 'number' ? ov.startTime : 0;
                const duration = typeof ov.duration === 'number' ? ov.duration : 5;
                const endTime = startTime + duration;

                // Fade Logic (1s fade in/out)
                const fadeDuration = 1;
                // Alpha expression for text: 
                // if t < start+1: fade in
                // if t > end-1: fade out
                // else 1
                const alphaExpr = `if(lt(t,${startTime + fadeDuration}),(t-${startTime})/${fadeDuration},if(lt(t,${endTime - fadeDuration}),1,(${endTime}-t)/${fadeDuration}))`;

                const enable = `enable='between(t,${startTime},${endTime})'`;

                if (ov.type === 'text') {
                    // Escape text
                    const safeText = (ov.content || '').replace(/'/g, "\\'").replace(/:/g, "\\:");

                    // Use alpha parameter for fading text (affects border too)
                    // Note: alpha expression must be wrapped in quotes
                    filterComplex += `${lastStream}drawtext=fontfile='${fontPath}':text='${safeText}':fontsize=${ov.fontSize || ov.style?.fontSize || 60}:fontcolor=${ov.color || ov.style?.color || 'white'}:borderw=2:bordercolor=black:x=${x}:y=${y}:alpha='${alphaExpr}':${enable}${nextLabel};`;
                    lastStream = nextLabel;
                } else if (ov.type === 'image' && overlayImagePaths.has(idx)) {
                    // Image Overlay
                    const inputIdx = overlayInputOffset + currentOvImgIndex;
                    currentOvImgIndex++;

                    const ovImgLabel = `[ovimg${idx}]`;
                    const ovFadedLabel = `[ovimgfade${idx}]`;

                    // 3. Fade in/out
                    // Input is already looped and timed via -loop 1 -t duration
                    filterComplex += `[${inputIdx}:v]fade=in:st=${startTime}:d=${fadeDuration}:alpha=1,fade=out:st=${endTime - fadeDuration}:d=${fadeDuration}:alpha=1${ovFadedLabel};`;

                    // 4. Overlay
                    // Drawtext uses 'w','h' for main video dimensions.
                    // Overlay uses 'W','H' for main, and 'w','h' for overlay dimensions.

                    // Transform x/y expressions:
                    // 1. text_w -> w (overlay width)
                    // 2. text_h -> h (overlay height)
                    // 3. w (as standalone word) -> W (main width)
                    // 4. h (as standalone word) -> H (main height)

                    let imgX = x;
                    let imgY = y;

                    // Careful replacement to avoid double replacement
                    // Replace 'text_w' with placeholder, then 'w' with 'W', then placeholder with 'w'
                    imgX = imgX.replace(/text_w/g, 'overlay_w_placeholder')
                        .replace(/\bw\b/g, 'W')
                        .replace(/overlay_w_placeholder/g, 'w');

                    imgX = imgX.replace(/text_h/g, 'overlay_h_placeholder')
                        .replace(/\bh\b/g, 'H')
                        .replace(/overlay_h_placeholder/g, 'h');

                    imgY = imgY.replace(/text_w/g, 'overlay_w_placeholder')
                        .replace(/\bw\b/g, 'W')
                        .replace(/overlay_w_placeholder/g, 'w');

                    imgY = imgY.replace(/text_h/g, 'overlay_h_placeholder')
                        .replace(/\bh\b/g, 'H')
                        .replace(/overlay_h_placeholder/g, 'h');

                    filterComplex += `${lastStream}${ovFadedLabel}overlay=x=${imgX}:y=${imgY}:${enable}${nextLabel};`;
                    lastStream = nextLabel;
                }
            });
            videoMap = lastStream;
        } else if (!isAdvanced) {
            // Legacy Title Overlay
            const cleanTitle = (job.title_text || '').replace(/'/g, "'\\''");
            const nextLabel = '[vtitle]';
            filterComplex += `${lastStream}trim=0:${totalDuration},setpts=PTS-STARTPTS,drawtext=fontfile='${fontPath}':text='${cleanTitle}':fontsize=80:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2+150${nextLabel};`;
            lastStream = nextLabel;
            videoMap = lastStream;
        }

        // --- Audio ---
        // Concatenate audio tracks
        const audioOffset = videoInputs.length;
        const musicConcatInputs = musicPaths.map((_, i) => `[${audioOffset + i}:a]`).join('');
        const musicConcat = musicPaths.length > 0
            ? `${musicConcatInputs}concat=n=${musicPaths.length}:v=0:a=1[aout]`
            : '';

        if (musicConcat) {
            filterComplex += musicConcat;
        }

        // --- Final Command ---
        const mapV = `-map "${videoMap}"`;
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
