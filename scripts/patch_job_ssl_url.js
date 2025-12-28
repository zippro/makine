
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const JOB_ID = '830a869e-e2e0-4efe-b969-71ffd86d0383';
const NEW_URL = 'https://46.62.209.244.nip.io/videos/830a869e-e2e0-4efe-b969-71ffd86d0383.mp4';

async function patch() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Patching job ${JOB_ID} with secure SSL URL...`);
    const { error } = await supabase
        .from('video_jobs')
        .update({
            status: 'done',
            video_url: NEW_URL
        })
        .eq('id', JOB_ID);

    if (error) console.error('Error:', error);
    else console.log('Job patched successfully:', NEW_URL);
}

patch();
