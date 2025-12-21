const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findCircularJob() {
    // We need to filter by the JSON column visualizer_config -> style
    // Supabase postgrest equivalent for JSON selector is tricky in JS client sometimes, 
    // but we can just fetch recent jobs and filter in JS if needed, or try filter syntax.

    const { data, error } = await supabase
        .from('video_jobs')
        .select('id, created_at, status, visualizer_config, error_message')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Filter for style 'round'
    const circularJob = data.find(j => j.visualizer_config && j.visualizer_config.style === 'round');

    if (circularJob) {
        console.log('Found Circular Job:', JSON.stringify(circularJob, null, 2));
    } else {
        console.log('No recent circular job found in last 20.');
    }
}

findCircularJob();
