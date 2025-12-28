
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetLastProcessingJob() {
    console.log('Finding last stuck job...');

    // Find the most recent job that is 'processing'
    const { data: jobs, error: findError } = await supabase
        .from('video_jobs')
        .select('id, status, created_at')
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1);

    if (findError) {
        console.error('Error finding job:', findError);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log('No processing jobs found.');
        return;
    }

    const job = jobs[0];
    console.log(`Found stuck job: ${job.id} (Created: ${job.created_at})`);

    // Reset it
    const { error: updateError } = await supabase
        .from('video_jobs')
        .update({ status: 'queued', progress: 0 })
        .eq('id', job.id);

    if (updateError) {
        console.error('Error resetting job:', updateError);
    } else {
        console.log(`✅ Job ${job.id} reset to 'queued'.`);
    }
}

resetLastProcessingJob();
