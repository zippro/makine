require('dotenv').config({ path: '.env.hetzner.temp' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
    const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (error) {
        console.error(`Error checking ${tableName}:`, error.message);
        return null;
    }
    return count;
}

async function runInventory() {
    console.log('--- Data Inventory ---');
    const musicCount = await checkTable('music_library');
    const imagesCount = await checkTable('images');
    const animationsCount = await checkTable('animations');

    console.log(`Music Tracks: ${musicCount}`);
    console.log(`Images: ${imagesCount}`);
    console.log(`Animations: ${animationsCount}`);
    console.log('----------------------');
}

runInventory();
