require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resetJob() {
    const jobId = '4255afca-4185-4000-9fe1-f0aec9b06722';
    console.log(`Resetting Job ID: ${jobId}`);

    const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'queued', error_message: null, video_url: null })
        .eq('id', jobId);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Job reset to "queued".');
    }
}

resetJob();
