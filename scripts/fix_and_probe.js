require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixAndProbe() {
    const jobId = '2d94ef08-b897-460d-8bef-306444cb28ed';
    const videoUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co/storage/v1/object/public/audio/videos/2d94ef08-b897-460d-8bef-306444cb28ed_output.mp4';

    console.log('1. Updating DB...');
    const { error } = await supabase
        .from('video_jobs')
        .update({
            status: 'done',
            video_url: videoUrl,
            error_message: null
        })
        .eq('id', jobId);

    if (error) console.error('DB Error:', error);
    else console.log('DB Updated.');

    console.log('\n2. Probing Video Duration...');
    try {
        // Use ffprobe on the remote URL if possible, or curl header
        // ffprobe might be slow on remote, let's try reading header with curl or just trust user and inspect local logs if possible
        // Better: probe the URL directly
        const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoUrl}"`;
        const duration = execSync(cmd).toString().trim();
        console.log(`Duration: ${duration} seconds`);
    } catch (e) {
        console.error('Probe failed:', e.message);
    }
}

fixAndProbe();
