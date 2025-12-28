
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const jobId = process.argv[2];

if (!jobId) {
    console.error('Please provide a job ID to delete');
    process.exit(1);
}

async function deleteJob() {
    console.log(`Attempting to delete job ${jobId}...`);

    const { error } = await supabase
        .from('video_jobs')
        .delete()
        .eq('id', jobId);

    if (error) {
        console.error('Delete Failed:', error);
    } else {
        console.log('Delete Successful');
    }
}

deleteJob();
