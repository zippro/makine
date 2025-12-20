const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://lcysphtjcrhgopjrmjca.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM'
);

(async () => {
    console.log('Checking recent jobs...');
    const { data: jobs, error } = await supabase
        .from('video_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching jobs:', error);
    } else {
        console.table(jobs.map(j => ({
            id: j.id,
            status: j.status,
            created: new Date(j.created_at).toLocaleTimeString(),
            error: j.error ? j.error.substring(0, 50) + '...' : 'null'
        })));

        // Detailed log for the most recent stuck job
        const stuckJob = jobs.find(j => j.status === 'processing');
        if (stuckJob) {
            console.log('\n--- Detail for Stuck Job ---');
            console.log('ID:', stuckJob.id);
            console.log('Logs:', stuckJob.logs || 'No logs');
        }
    }
})();
