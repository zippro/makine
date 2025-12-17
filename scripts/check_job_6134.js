require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkJob() {
    const { data: job, error } = await supabase
        .from('video_jobs')
        .select('id, status, error_message')
        .ilike('id', '61341edf%')
        .single();

    if (error) console.error(error);
    else console.log(job);
}

checkJob();
