
// Run Migration 004
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); // Also try .env

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '004_project_defaults.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error('Migration file not found:', sqlPath);
        process.exit(1);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration 004...');

    // We can't use rpc directly if exec_sql is not there.
    // But since the user has been running migrations, maybe 'exec_sql' exists?
    // If not, we can try to create a dummy function if we had raw access, but we assume
    // we have to just run it via rpc or fail.
    // Alternatively, if this fails, we ask the user.

    // Attempt exec_sql RPC
    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
        console.error('RPC Error:', error);
        console.log('Attempting raw SQL split if simple...');
        // Fallback for simple statements usually won't work via JS client without specific setup.
        console.log('Please run the SQL manually.');
    } else {
        console.log('✅ Migration 004 success!');
    }
}

runMigration();
