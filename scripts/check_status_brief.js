const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
    const jobId = '604e1825-2341-4df5-ac0c-7384f3b6a7d3';

    // Check Status
    const { data: job, error } = await supabase.from('video_jobs').select('status, updated_at').eq('id', jobId).single();
    if (job) {
        console.log(`Job Status: ${job.status}`);
        console.log(`Last Updated: ${job.updated_at}`);
    } else {
        console.error('Job not found:', error?.message);
    }
}

checkStatus();
