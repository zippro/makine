const { createClient } = require('@supabase/supabase-js');

// Using the same hardcoded credentials as found in local_ffmpeg_worker.js
const supabase = createClient(
    'https://lcysphtjcrhgopjrmjca.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM'
);

async function resetStuckJobs() {
    console.log('🔍 Finding stuck jobs (status="processing")...');

    // 1. Get all stuck jobs
    const { data: jobs, error } = await supabase
        .from('video_jobs')
        .select('id, created_at')
        .eq('status', 'processing');

    if (error) {
        console.error('❌ Error fetching jobs:', error.message);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log('✅ No stuck jobs found.');
        return;
    }

    console.log(`⚠️ Found ${jobs.length} stuck jobs. Resetting them to 'queued'...`);

    // 2. Reset them
    for (const job of jobs) {
        const { error: updateError } = await supabase
            .from('video_jobs')
            .update({ status: 'queued', error_message: null }) // Clear any error message? Or leave it. Let's clear it just in case.
            .eq('id', job.id);

        if (updateError) {
            console.error(`❌ Failed to reset job ${job.id}:`, updateError.message);
        } else {
            console.log(`✅ Reset job ${job.id}`);
        }
    }

    console.log('🎉 Done.');
}

resetStuckJobs();
