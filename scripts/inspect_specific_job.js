const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJob() {
    const jobId = '0df4dc02-d45f-4422-ba9f-4771d62c52c8';
    console.log(`Checking status for job ${jobId}...`);

    const { data, error } = await supabase
        .from('video_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Job Data:', JSON.stringify(data, null, 2));
    }
}

checkJob();
