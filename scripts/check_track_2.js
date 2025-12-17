require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTrack2() {
    console.log('Checking Track 2...');
    const { data: job, error } = await supabase
        .from('video_jobs')
        .select(`
            video_music (
                order_index,
                music_library ( id, filename, url, duration_seconds )
            )
        `)
        .eq('id', '2d94ef08-b897-460d-8bef-306444cb28ed')
        .single();

    if (error) { console.error(error); return; }

    const tracks = job.video_music.sort((a, b) => a.order_index - b.order_index);
    if (tracks.length < 2) { console.log('No track 2'); return; }

    const t2 = tracks[1];

    console.log('Track 1 (Index 1):', t2.music_library.filename);
    console.log('URL:', t2.music_library.url);

    // Probe URL
    try {
        const cmd = `curl -I "${t2.music_library.url}"`;
        const header = execSync(cmd).toString();
        console.log('\nHeader:\n', header);
    } catch (e) {
        console.error('Probe failed:', e.message);
    }
}

checkTrack2();
