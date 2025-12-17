require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resetJob() {
    const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'queued', error_message: null })
        .eq('id', '61341edf-86aa-423f-9832-329b12f00705');

    if (error) console.error(error);
    else console.log('Reset job 6134 to queued.');
}

resetJob();
