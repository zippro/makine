
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const jobId = process.argv[2];

if (!jobId) {
    console.error('Please provide a job ID');
    process.exit(1);
}

async function checkStatus() {
    const { data, error } = await supabase
        .from('video_jobs')
        .select('id, status, progress, error_message, updated_at')
        .eq('id', jobId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Job Status: ${data.status} | Progress: ${data.progress}% | Updated: ${data.updated_at}`);
    if (data.error_message) console.log(`Error: ${data.error_message}`);
}

checkStatus();
