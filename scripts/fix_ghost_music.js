require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixGhost() {
    const badUrlPart = '1765750645206-hssswk.mp3';

    console.log(`Searching for music with URL containing: ${badUrlPart}`);

    // 1. Find the ID
    const { data: toDelete, error: findError } = await supabase
        .from('music_library')
        .select('*')
        .ilike('url', `%${badUrlPart}%`);

    if (findError) {
        console.error('Find Error:', findError);
        return;
    }

    if (!toDelete || toDelete.length === 0) {
        console.log('No ghost record found in DB.');
        return;
    }

    console.log('Found ghost records:', toDelete.length);
    toDelete.forEach(r => console.log(`- ${r.title} (${r.id})`));

    // 2. Delete
    const { error: delError } = await supabase
        .from('music_library')
        .delete()
        .ilike('url', `%${badUrlPart}%`);

    if (delError) {
        console.error('Delete Error:', delError);
    } else {
        console.log('Ghost record(s) deleted successfully.');
    }
}

fixGhost();
