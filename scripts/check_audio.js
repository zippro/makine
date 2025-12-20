const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAudio() {
    console.log('--- Checking Latest Job Audio ---');
    // Get latest job
    const { data: jobs } = await supabase.from('video_jobs').select('id, created_at, status').order('created_at', { ascending: false }).limit(1);

    if (!jobs || jobs.length === 0) {
        console.log('No jobs found.');
        return;
    }

    const job = jobs[0];
    console.log(`Job ID: ${job.id}`);
    console.log(`Status: ${job.status}`);

    // Check music links
    const { data: musicRel, error } = await supabase
        .from('video_music')
        .select('order_index, music_library(id, url)')
        .eq('video_job_id', job.id)
        .order('order_index');

    if (error) {
        console.error('Error fetching music:', error.message);
    } else {
        console.log(`Music Tracks Found: ${musicRel.length}`);
        musicRel.forEach((m, i) => {
            console.log(`[${m.order_index}] URL: ${m.music_library?.url || 'NULL'}`);
        });

        if (musicRel.length < 2) {
            console.warn("⚠️ Mismatch: User claimed adding 2 MP3s, but DB has fewer.");
        }
    }
}

checkAudio();
