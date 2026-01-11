// Check projects and their todo lists
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkProjectsAndTodos() {
    console.log('📊 Checking projects and their todo lists...\n');

    // Get all projects
    const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, name')
        .order('created_at');

    if (projError) {
        console.error('Error:', projError.message);
        return;
    }

    console.log(`Found ${projects.length} projects:\n`);

    for (const project of projects) {
        console.log(`📁 Project: ${project.name}`);

        // Get folders for this project
        const { data: folders } = await supabase
            .from('project_folders')
            .select('id, path')
            .eq('project_id', project.id);

        // Get todo lists for this project
        const { data: todoLists } = await supabase
            .from('todo_lists')
            .select('id, name, folder_id')
            .eq('project_id', project.id);

        // Get default tasks for this project
        const { data: defaultTasks } = await supabase
            .from('default_tasks')
            .select('id, title')
            .eq('project_id', project.id);

        console.log(`   Folders: ${folders?.length || 0}`);
        console.log(`   Todo Lists: ${todoLists?.length || 0}`);
        console.log(`   Default Tasks: ${defaultTasks?.length || 0}`);

        if (todoLists && todoLists.length > 0) {
            for (const list of todoLists) {
                const { data: items } = await supabase
                    .from('todo_items')
                    .select('id')
                    .eq('todo_list_id', list.id);
                console.log(`      - "${list.name}": ${items?.length || 0} tasks`);
            }
        }
        console.log('');
    }
}

checkProjectsAndTodos();
