require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resetJob() {
    const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'queued', error_message: null })
        .eq('id', '57e09344-77f6-4d08-8e6f-53093952f1e2'); // ID derived from screenshot/previous context if visible, or I'll query for error status

    if (error) console.error(error);
    else console.log('Reset job 57e0 to queued.');
}

// Actually better to query for the error job ID to be sure
async function resetErrorJob() {
    const { data } = await supabase.from('video_jobs').select('id').eq('status', 'error').order('created_at', { ascending: false }).limit(1).single();
    if (data) {
        console.log(`Resetting errored job: ${data.id}`);
        await supabase.from('video_jobs').update({ status: 'queued', error_message: null }).eq('id', data.id);
    }
}

resetErrorJob();
