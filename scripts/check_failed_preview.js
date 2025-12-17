require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const JOB_ID = 'd5f3ea6c-835b-4357-8433-74aec9546425';

async function checkJobData() {
    console.log(`Checking Job: ${JOB_ID}`);
    const { data, error } = await supabase
        .from('video_jobs')
        .select('id, image_url, audio_url, status')
        .eq('id', JOB_ID)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Job Data:', data);
    }
}

checkJobData();
