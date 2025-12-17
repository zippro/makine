
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase Service Role env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTable(tableName) {
    console.log(`Listing ${tableName}...`);
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
        console.error(`Error listing ${tableName}:`, error);
    } else {
        console.log(`Found ${data.length} records in ${tableName}.`);
        if (data.length > 0) {
            console.log('Sample:', data[0]);
        }
    }
}

async function runDebug() {
    await listTable('images');
    await listTable('animations');
    await listTable('music_library');
    await listTable('video_jobs');
}

runDebug();
