require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkLatest() {
    console.log('--- Latest Job Debug ---');
    const { data: job, error } = await supabase
        .from('video_jobs')
        .select(`
            id, status, created_at, error_message, title_text,
            video_music (
                order_index,
                music_library ( id, filename, duration_seconds, url )
            )
        `)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Job ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Title: ${job.title_text}`);
    if (job.error_message) console.log(`Error: ${job.error_message}`);

    console.log('\nMusic Tracks:');
    if (job.video_music && job.video_music.length > 0) {
        job.video_music.forEach(vm => {
            console.log(`- [#${vm.order_index}] ${vm.music_library.filename} (${vm.music_library.duration_seconds}s)`);
        });
    } else {
        console.log('No music tracks found linked.');
    }
}

checkLatest();
