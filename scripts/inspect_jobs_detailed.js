
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    const { data: jobs, error } = await supabase
        .from('video_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    jobs.forEach(job => {
        console.log('--------------------------------------------------');
        console.log(`ID: ${job.id}`);
        console.log(`Title: ${job.title_text}`);
        console.log(`Status: ${job.status}`);
        console.log(`Animation ID: ${job.animation_id}`);
        console.log(`Audio URL: ${job.audio_url ? 'Yes' : 'No'} (${job.audio_url})`);
        console.log(`Assets Count: ${job.assets ? job.assets.length : 0}`);
        console.log(`Created At: ${job.created_at}`);
        console.log('--------------------------------------------------');
    });
}

inspect();
