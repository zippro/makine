const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log('--- Music Library ---');
    const { data: music, error: musicError } = await supabase
        .from('music_library')
        .select('*')
        .limit(5);

    if (musicError) console.error(musicError);
    else console.log(JSON.stringify(music, null, 2));

    console.log('\n--- Animations ---');
    const { data: anims, error: animsError } = await supabase
        .from('animations')
        .select('*')
        .limit(2);

    if (animsError) console.error(animsError);
    else console.log(JSON.stringify(anims, null, 2));
}

inspectSchema();
