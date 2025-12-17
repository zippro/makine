require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkJob() {
    const jobId = 'fc74c228-ba7c-45b7-8669-9ba7e4a1cdb0';
    console.log(`Checking Job ID: ${jobId}`);

    const { data, error } = await supabase
        .from('video_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Job Details:');
        console.log(`- Status: ${data.status}`);
        console.log(`- Video URL: ${data.video_url}`);
        console.log(`- Error Message: ${data.error_message}`);
        console.log(`- Created At: ${data.created_at}`);
    }
}

checkJob();
