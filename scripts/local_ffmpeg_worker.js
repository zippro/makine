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

        // 2. Fetch Job Details (Joined)
        // We need to fetch again to get the relation data if not passed, but our loop will likely just grab raw job.
        // We need the music and animation URLs. The job row has image_url (animation) and audio_url (first music).
        // But for multi-track, we need to query the junction table.

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
        const animationUrl = job.image_url; // Legacy field name holds animation url

        // 3a. Use Local System Font (Reliable/Elegant)
        const fontPath = '/System/Library/Fonts/Supplemental/Georgia.ttf';
        // await downloadFile(fontUrl, fontPath); // Disabled external download

        // 3b. Download Assets
        console.log('Downloading assets...');
        const videoPath = path.join(workDir, 'input_video.mp4');
        try {
            await downloadFile(animationUrl, videoPath);
            // Validate Video
            const vidStats = fs.statSync(videoPath);
            if (vidStats.size < 1000) throw new Error('Video file too small (<1KB)');
        } catch (e) {
            throw new Error(`Critical: Failed to load animation: ${e.message}`);
        }

        const musicPaths = [];
        for (let i = 0; i < musicUrls.length; i++) {
            const mPath = path.join(workDir, `input_audio_${i}.mp3`);
            try {
                if (!musicUrls[i]) {
                    console.warn(`Skipping Track ${i}: No URL provided.`);
                    continue;
                }

                await downloadFile(musicUrls[i], mPath);

                // Validate Audio
                if (!fs.existsSync(mPath)) throw new Error('File missing after download');
                const stats = fs.statSync(mPath);
                if (stats.size < 1000) { // < 1KB
                    console.warn(`Skipping Track ${i}: File too small (${stats.size} bytes). Likely corrupted.`);
                    continue; // Skip this track
                }

                musicPaths.push(mPath);
                console.log(`Track ${i} OK (${stats.size} bytes).`);

            } catch (e) {
                console.warn(`Skipping Track ${i} due to error: ${e.message}`);
                // Continue to next track, don't crash job
            }
        }

        if (musicPaths.length === 0) {
            console.warn('Warning: No valid music tracks found. Video will be silent.');
        }

        // 4. Calculate Logic
        let totalDuration = Math.round(musicDurations.reduce((sum, d) => sum + (d || 0), 0));
        console.log(`calculated totalDuration: ${totalDuration} (Rounded)`);
        if (totalDuration === 0) totalDuration = 10;

        const loopCount = Math.ceil(totalDuration / 10) + 1;
        const cleanTitle = (job.title_text || '').replace(/'/g, "'\\''");

        // Text Animation Settings
        const tStart = 7;
        const fadeDur = 1;
        const tEnd = tStart + 4; // Total visible time including fades (7 to 11)

        // Alpha Expression (No backslashes, single quotes protect commas)
        // if t < tStart: 0
        // if t < tStart + fadeDur: (t - tStart) / fadeDur  (Fade In)
        // if t < tEnd - fadeDur: 1 (Hold)
        // if t < tEnd: (tEnd - t) / fadeDur (Fade Out)
        // else: 0
        const alphaExpr = `if(lt(t,${tStart}),0,if(lt(t,${tStart + fadeDur}),(t-${tStart})/${fadeDur},if(lt(t,${tEnd - fadeDur}),1,if(lt(t,${tEnd}),(${tEnd}-t)/${fadeDur},0))))`;

        // 5. Build FFmpeg Command
        const musicInputs = musicPaths.map(p => `-i "${p}"`).join(' ');
        const musicConcatInputs = musicPaths.map((_, i) => `[${i + 1}:a]`).join('');
        const musicConcat = musicPaths.length > 0
            ? `${musicConcatInputs}concat=n=${musicPaths.length}:v=0:a=1[a]`
            : '';

        // Note: fontpath is safe in /tmp
        // Reverting to simple drawtext to ensure stability (complex filters/alpha causing crash)
        // Font: Playfair Display, Position: Lower Center
        let filterComplex = `[0:v]trim=0:${totalDuration},setpts=PTS-STARTPTS,drawtext=fontfile='${fontPath}':text='${cleanTitle}':fontsize=80:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2+150[v]`;

        if (musicConcat) {
            filterComplex += `;${musicConcat}`;
        }

        const outputPath = path.join(workDir, 'output.mp4');

        // Note: Using "libx264" with higher compression (crf 28) to ensure we stay under Supabase 50MB limit
        // preset fast for speed
        let command = `ffmpeg -y -stream_loop ${loopCount} -i "${videoPath}" ${musicInputs} -filter_complex "${filterComplex}" -map "[v]"`;

        if (musicConcat) command += ` -map "[a]"`;

        command += ` -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k -movflags +faststart -shortest "${outputPath}"`;

        console.log('Running FFmpeg...');
        console.log('Command:', command);
        execSync(command, { stdio: 'inherit' });

        // 6. Upload Output
        console.log('Uploading output...');
        const fileBuffer = fs.readFileSync(outputPath);
        const stats = fs.statSync(outputPath);
        console.log(`Video Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        const fileName = `${job.project_id}/${jobId}/output.mp4`; // Structured by project/job

        const { error: uploadError } = await supabase.storage
            .from('videos') // Try 'videos' first
            .upload(fileName, fileBuffer, { contentType: 'video/mp4', upsert: true });

        // Wait, I don't know if 'videos' bucket exists.
        // Let's use the 'audio' bucket but put it in a 'videos/' folder to be safe since I know 'audio' exists and is public.
        const safeBucket = 'audio';
        const safePath = `videos/${jobId}_output.mp4`;

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

        if (finalUpdateError) {
            throw new Error('Final DB Update Failed: ' + finalUpdateError.message);
        }

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
