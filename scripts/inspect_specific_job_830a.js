
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJob() {
    const { data, error } = await supabase
        .from('video_jobs')
        .select('id, status, video_url, error_message, created_at')
        .eq('id', '830a869e-e2e0-4efe-b969-71ffd86d0383')
        .single();

    if (error) {
        console.error('Error fetching job:', error);
    } else {
        console.log('Job Details:', data);
    }
}

checkJob();
