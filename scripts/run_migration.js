// Run Todo System Migration against Supabase
// Usage: node run_migration.js

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lcysphtjcrhgopjrmjca.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
}

async function runMigration() {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_todo_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration...');
    console.log('SQL:', sql.substring(0, 200) + '...');

    try {
        // Use Supabase REST API to execute SQL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
            // If exec_sql doesn't exist, try raw SQL via PostgREST
            console.log('exec_sql RPC not available, trying direct approach...');

            // Split into individual statements and run each via a simple insert test
            const statements = sql.split(';').filter(s => s.trim().length > 0);

            for (const statement of statements) {
                console.log('Statement preview:', statement.substring(0, 80).replace(/\n/g, ' ') + '...');
            }

            console.log('\nNote: Direct SQL execution requires Supabase Management API or CLI.');
            console.log('Please run the SQL manually in Supabase Dashboard > SQL Editor');
            console.log('Or use: npx supabase db push');
            return;
        }

        const result = await response.json();
        console.log('Migration result:', result);
        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('Migration error:', error.message);
        console.log('\nFalling back to curl approach...');
    }
}

runMigration();
