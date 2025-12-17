
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Try both paths to be sure
const envPath = path.resolve(__dirname, '../.env.local');
console.log('Loading env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading env:', result.error);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Key length:', serviceRoleKey ? serviceRoleKey.length : 0);

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase Service Role env vars');
    process.exit(1);

}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function countTable(tableName) {
    const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error(`Error counting ${tableName}:`, error);
    } else {
        console.log(`Table ${tableName} has ${count} rows.`);
    }
}

async function checkProjectImages() {
    console.log('Checking images for Jazz Club Vibe...');
    const { data, error } = await supabase
        .from('images')
        .select('*') // Select all to see url
        .eq('project_id', '982ae248-4d54-4819-b3da-686800081df5')
        .limit(1);

    if (error) console.error(error);
    else {
        console.log(`Found ${data.length} images for this project.`);
        if (data.length > 0) console.log(data[0]);
    }
}

async function runDiag() {
    await countTable('images');
    await checkProjectImages();
}

runDiag();
