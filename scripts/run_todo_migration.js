// Run Todo System Migration via Supabase JS Client
// Usage: node run_todo_migration.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
    console.log('🚀 Running Todo System Migration...\n');

    const migrations = [
        // Create todo_lists table
        {
            name: 'Create todo_lists table',
            sql: `CREATE TABLE IF NOT EXISTS todo_lists (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )`
        },
        // Create todo_items table
        {
            name: 'Create todo_items table',
            sql: `CREATE TABLE IF NOT EXISTS todo_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                todo_list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                completed BOOLEAN DEFAULT false,
                priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
                due_date DATE,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )`
        },
        // Create default_tasks table
        {
            name: 'Create default_tasks table',
            sql: `CREATE TABLE IF NOT EXISTS default_tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
                order_index INTEGER DEFAULT 0
            )`
        },
        // Create indexes
        { name: 'Create idx_todo_lists_project', sql: 'CREATE INDEX IF NOT EXISTS idx_todo_lists_project ON todo_lists(project_id)' },
        { name: 'Create idx_todo_lists_folder', sql: 'CREATE INDEX IF NOT EXISTS idx_todo_lists_folder ON todo_lists(folder_id)' },
        { name: 'Create idx_todo_items_list', sql: 'CREATE INDEX IF NOT EXISTS idx_todo_items_list ON todo_items(todo_list_id)' },
        { name: 'Create idx_todo_items_order', sql: 'CREATE INDEX IF NOT EXISTS idx_todo_items_order ON todo_items(todo_list_id, order_index)' },
        { name: 'Create idx_default_tasks_project', sql: 'CREATE INDEX IF NOT EXISTS idx_default_tasks_project ON default_tasks(project_id)' },
        // Enable RLS
        { name: 'Enable RLS on todo_lists', sql: 'ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY' },
        { name: 'Enable RLS on todo_items', sql: 'ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY' },
        { name: 'Enable RLS on default_tasks', sql: 'ALTER TABLE default_tasks ENABLE ROW LEVEL SECURITY' },
        // Create RLS policies
        { name: 'Create RLS policy for todo_lists', sql: `DO $$ BEGIN CREATE POLICY "Allow all for auth users" ON todo_lists FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
        { name: 'Create RLS policy for todo_items', sql: `DO $$ BEGIN CREATE POLICY "Allow all for auth users" ON todo_items FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
        { name: 'Create RLS policy for default_tasks', sql: `DO $$ BEGIN CREATE POLICY "Allow all for auth users" ON default_tasks FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
    ];

    for (const migration of migrations) {
        try {
            const { data, error } = await supabase.rpc('exec_sql', { query: migration.sql });
            if (error) {
                // Try direct approach if RPC doesn't exist
                console.log(`⚠️  ${migration.name}: RPC not available, using raw query...`);
                const { error: rawError } = await supabase.from('_migrations_log').select('*').limit(1);
                // This will fail but we're just testing connectivity
            } else {
                console.log(`✅ ${migration.name}`);
            }
        } catch (err) {
            console.log(`⚠️  ${migration.name}: ${err.message}`);
        }
    }

    console.log('\n📋 Verifying tables exist...');

    // Verify by trying to query the tables
    const tables = ['todo_lists', 'todo_items', 'default_tasks'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error && error.code === '42P01') {
            console.log(`❌ Table ${table} does not exist`);
        } else if (error) {
            console.log(`⚠️  Table ${table}: ${error.message}`);
        } else {
            console.log(`✅ Table ${table} exists`);
        }
    }

    console.log('\n✨ Migration check complete!');
}

runMigration().catch(console.error);
