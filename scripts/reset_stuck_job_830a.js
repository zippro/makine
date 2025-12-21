
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetJob() {
    const jobId = '830a869e-e2e0-4efe-b969-71ffd86d0383';
    console.log(`Resetting stuck job ${jobId}...`);

    const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'queued', progress: 0 })
        .eq('id', jobId);

    if (error) console.error('Error:', error);
    else console.log('Job reset to queued.');
}

resetJob();
