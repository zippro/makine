require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixJob() {
    console.log('Fixing Job 8292...');
    const url = 'https://lcysphtjcrhgopjrmjca.supabase.co/storage/v1/object/public/audio/videos/8292701f-a769-453a-86ea-82999cc525c9_output.mp4';

    const { error } = await supabase
        .from('video_jobs')
        .update({
            status: 'done',
            video_url: url,
            error_message: null
        })
        .eq('id', '8292701f-a769-453a-86ea-82999cc525c9');

    if (error) console.error('Error:', error);
    else console.log('Fixed: Set to DONE with URL.');
}

fixJob();
