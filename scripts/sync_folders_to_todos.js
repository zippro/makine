// Sync existing folders to todo lists with default tasks
// Usage: node sync_folders_to_todos.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function syncFoldersToTodos() {
    console.log('🔄 Syncing existing folders to todo lists...\n');

    try {
        // 1. Get all project folders
        const { data: folders, error: foldersError } = await supabase
            .from('project_folders')
            .select('*')
            .order('created_at', { ascending: true });

        if (foldersError) {
            console.error('Error fetching folders:', foldersError.message);
            return;
        }

        console.log(`📁 Found ${folders?.length || 0} folders\n`);

        if (!folders || folders.length === 0) {
            console.log('No folders to sync.');
            return;
        }

        // 2. Get existing todo lists (to avoid duplicates)
        const { data: existingLists, error: listsError } = await supabase
            .from('todo_lists')
            .select('folder_id');

        if (listsError) {
            console.error('Error fetching existing lists:', listsError.message);
            return;
        }

        const existingFolderIds = new Set(existingLists?.map(l => l.folder_id) || []);

        // 3. Get all default tasks grouped by project
        const { data: defaultTasks, error: defaultsError } = await supabase
            .from('default_tasks')
            .select('*')
            .order('order_index', { ascending: true });

        if (defaultsError) {
            console.log('⚠️  Could not fetch default tasks:', defaultsError.message);
        }

        const defaultTasksByProject = {};
        if (defaultTasks) {
            for (const task of defaultTasks) {
                if (!defaultTasksByProject[task.project_id]) {
                    defaultTasksByProject[task.project_id] = [];
                }
                defaultTasksByProject[task.project_id].push(task);
            }
        }

        // 4. Create todo lists for folders that don't have one
        let created = 0;
        let skipped = 0;

        for (const folder of folders) {
            if (existingFolderIds.has(folder.id)) {
                console.log(`⏭️  Skipping "${folder.path}" - already has a todo list`);
                skipped++;
                continue;
            }

            // Create todo list for this folder
            const { data: newList, error: createError } = await supabase
                .from('todo_lists')
                .insert({
                    project_id: folder.project_id,
                    folder_id: folder.id,
                    name: folder.path
                })
                .select()
                .single();

            if (createError) {
                console.error(`❌ Error creating list for "${folder.path}":`, createError.message);
                continue;
            }

            console.log(`✅ Created todo list: "${folder.path}"`);
            created++;

            // Add default tasks if available for this project
            const projectDefaults = defaultTasksByProject[folder.project_id];
            if (projectDefaults && projectDefaults.length > 0) {
                const tasksToCreate = projectDefaults.map((task, index) => ({
                    todo_list_id: newList.id,
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    order_index: index,
                    completed: false
                }));

                const { error: tasksError } = await supabase
                    .from('todo_items')
                    .insert(tasksToCreate);

                if (tasksError) {
                    console.error(`   ⚠️  Error adding default tasks:`, tasksError.message);
                } else {
                    console.log(`   📋 Added ${tasksToCreate.length} default tasks`);
                }
            }
        }

        console.log('\n✨ Sync complete!');
        console.log(`   Created: ${created} todo lists`);
        console.log(`   Skipped: ${skipped} (already synced)`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

syncFoldersToTodos();
