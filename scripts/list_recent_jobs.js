require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listRecent() {
    const { data: jobs, error } = await supabase
        .from('video_jobs')
        .select('id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) console.error(error);
    else console.log(jobs);
}

listRecent();
