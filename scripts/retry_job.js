

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars. Ensure .env.local exists and has SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function retryJob() {
    const jobId = process.argv[2];
    if (!jobId) {
        console.error('Please provide a job ID');
        process.exit(1);
    }

    console.log(`Resetting job ${jobId} to queued...`);

    const { data, error } = await supabase
        .from('video_jobs')
        .update({
            status: 'queued',
            error_message: null,
            progress: 0,
            video_url: null
        })
        .eq('id', jobId)
        .select();

    if (error) {
        console.error('Error resetting job:', error);
    } else {
        console.log('Job reset successfully:', data);
    }
}

retryJob();
