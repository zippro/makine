const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://lcysphtjcrhgopjrmjca.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM'
);

async function forceComplete() {
    console.log('🔧 Manually completing jobs...');

    const jobs = [
        {
            id: 'f285826f-1e1e-48d4-87ad-fb1cee16a2c2',
            url: 'https://lcysphtjcrhgopjrmjca.supabase.co/storage/v1/object/public/audio/videos/f285826f-1e1e-48d4-87ad-fb1cee16a2c2_output.mp4',
            duration: 411 // Approximate from logs
        },
        {
            id: '9064ddbc-0ff3-4ba7-87d1-f1b261d2c5fc',
            url: 'https://lcysphtjcrhgopjrmjca.supabase.co/storage/v1/object/public/audio/videos/9064ddbc-0ff3-4ba7-87d1-f1b261d2c5fc_output.mp4',
            duration: 411 // Assumption
        }
    ];

    for (const job of jobs) {
        console.log(`Fixing ${job.id}...`);
        const { error } = await supabase.from('video_jobs').update({
            status: 'done',
            video_url: job.url,
            duration_seconds: job.duration,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);

        if (error) console.error('❌ Failed:', error.message);
        else console.log('✅ Success');
    }
}

forceComplete();
