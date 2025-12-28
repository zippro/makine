
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cloneJob() {
    const oldId = '4efe03b3-4c22-410b-ada7-2b709ccd36ec';

    // 1. Fetch old job
    const { data: oldJob, error } = await supabase.from('video_jobs').select('*').eq('id', oldId).single();
    if (error) {
        console.error('Failed to fetch:', error);
        return;
    }

    // 2. Prepare new payload (remove ID, created_at, etc)
    const newJob = { ...oldJob };
    delete newJob.id;
    delete newJob.created_at;
    delete newJob.updated_at;
    delete newJob.completed_at;
    delete newJob.error_message;
    delete newJob.progress;

    newJob.status = 'queued';
    newJob.title_text = newJob.title_text + ' (Reprocessed)'; // Distinguish title

    // 3. Insert
    const { data, error: insertError } = await supabase.from('video_jobs').insert(newJob).select().single();

    if (insertError) console.error('Insert failed:', insertError);
    else console.log(`Cloned job! New ID: ${data.id}`);
}

cloneJob();
