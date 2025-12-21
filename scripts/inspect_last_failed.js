const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastFailedJob() {
    const { data, error } = await supabase
        .from('video_jobs')
        .select('id, created_at, status, progress, error_message, title_text')
        .ilike('status', 'failed') // Look specifically for failed ones? Or just order by created_at desc
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Latest Failed Job:', JSON.stringify(data[0], null, 2));
    } else {
        // If no failed job found recently, maybe check the last job regardless of status
        console.log('No explicitly FAILED job found. Checking latest job...');
        const { data: latest } = await supabase.from('video_jobs').select('*').order('created_at', { ascending: false }).limit(1);
        console.log('Latest Job:', JSON.stringify(latest[0], null, 2));
    }
}

checkLastFailedJob();
