
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function reset() {
    const jobId = '4efe03b3-4c22-410b-ada7-2b709ccd36ec';
    console.log(`Resetting job ${jobId}...`);

    const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'queued', progress: 0, error_message: null })
        .eq('id', jobId);

    if (error) console.error(error);
    else console.log('Done.');
}
reset();
