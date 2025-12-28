
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const JOB_ID = '830a869e-e2e0-4efe-b969-71ffd86d0383';
const TEMP_URL = 'http://46.62.209.244:8080/output.mp4';

async function patch() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Patching job with temporary URL...');
    const { error } = await supabase
        .from('video_jobs')
        .update({
            status: 'done',
            progress: 100,
            video_url: TEMP_URL,
            error_message: null
        })
        .eq('id', JOB_ID);

    if (error) console.error('Error:', error);
    else console.log('Job patched to Done!');
}

patch();
