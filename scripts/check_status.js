const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://lcysphtjcrhgopjrmjca.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM'
);

async function checkJobs() {
    console.log('🔍 Checking recent jobs...');

    const { data: jobs, error } = await supabase
        .from('video_jobs')
        .select('id, status, created_at, updated_at, error_message')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.table(jobs);
}

checkJobs();
