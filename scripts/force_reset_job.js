const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function forceReset() {
    const jobId = '1e02ed76-12c4-4018-97e2-53f7ceddb53c'; // Kingo BonGO
    console.log(`Forcing reset for job ${jobId}...`);

    const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'queued' })
        .eq('id', jobId);

    if (error) console.error('Error:', error);
    else console.log('Success: Job set to queued.');
}

forceReset();
