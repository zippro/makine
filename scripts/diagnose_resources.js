require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const PROJECT_ID = '982ae248-4d54-4819-b3da-686800081df5';

async function checkTable(tableName) {
    console.log(`\n--- Checking Table: ${tableName} ---`);

    // Check total count
    const { count: total, error: errTotal } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

    if (errTotal) console.error('Error counting total:', errTotal);
    else console.log(`Total rows: ${total}`);

    // Check orphaned (null project_id)
    const { data: orphans, error: errOrphan } = await supabase
        .from(tableName)
        .select('id')
        .is('project_id', null);

    if (errOrphan) console.error('Error checking orphans:', errOrphan);
    else console.log(`Orphaned rows (null project_id): ${orphans.length}`);

    // Check project rows
    const { count: projectRows, error: errProject } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('project_id', PROJECT_ID);

    if (errProject) console.error('Error checking project rows:', errProject);
    else console.log(`Rows in 'Jazz Club Vibe': ${projectRows}`);
}

async function checkStorage(bucketName) {
    console.log(`\n--- Checking Storage Bucket: ${bucketName} ---`);
    const { data, error } = await supabase.storage.from(bucketName).list();
    if (error) {
        console.error(`Error listing ${bucketName}:`, error);
        return;
    }
    console.log(`Files found: ${data.length}`);
    if (data.length > 0) {
        console.log('Sample files:', data.slice(0, 3).map(f => f.name));
    }
}

async function run() {
    await checkTable('animations');
    await checkTable('music_library');
    await checkStorage('animations'); // Note: Bucket name might be 'animations' or 'videos' depending on setup, usually 'animations' based on previous context
    // Actually previous user used 'custom-models' or something? I'll check 'animations' and 'music'
    await checkStorage('audio');
}

run();
