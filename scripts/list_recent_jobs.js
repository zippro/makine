
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listFailedJobs() {
    const { data, error } = await supabase
        .from('video_jobs')
        .select('id, status, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Recent Jobs:');
    data.forEach(job => {
        console.log(`[${job.created_at}] ID: ${job.id} | Status: ${job.status} | Error: ${job.error_message}`);
    });
}

listFailedJobs();
