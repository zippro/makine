require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBucket() {
    const { data, error } = await supabase.storage.getBucket('audio');
    if (error) {
        console.log('Audio bucket not found? That is weird since we used it.');
    } else {
        console.log('Audio bucket exists. Worker will use "audio/videos/" path.');
    }
}
checkBucket();
