import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/todos - List todo lists for a project
export async function GET(request: NextRequest) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        // Fetch todo lists with item counts
        const { data, error } = await supabase
            .from('todo_lists')
            .select(`
                *,
                todo_items(id, completed)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching todo lists:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        // Transform to add computed counts
        const listsWithCounts = (data || []).map(list => ({
            ...list,
            items_count: list.todo_items?.length || 0,
            completed_count: list.todo_items?.filter((i: any) => i.completed).length || 0,
            todo_items: undefined // Remove nested items from this response
        }));

        return NextResponse.json(listsWithCounts);
    } catch (error) {
        console.error('Error in GET /api/todos:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/todos - Create new todo list (with optional folder)
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { project_id, name, folder_id, create_folder } = body;

        if (!project_id || !name) {
            return NextResponse.json({ error: 'Missing project_id or name' }, { status: 400 });
        }

        let finalFolderId = folder_id;

        // Create folder if requested
        if (create_folder && !folder_id) {
            const { data: folderData, error: folderError } = await supabase
                .from('project_folders')
                .insert({ project_id, path: name })
                .select()
                .single();

            if (folderError) {
                console.error('Error creating folder:', folderError);
                // Continue without folder if it fails
            } else {
                finalFolderId = folderData.id;
            }
        }

        // Create todo list
        const { data, error } = await supabase
            .from('todo_lists')
            .insert({
                project_id,
                name,
                folder_id: finalFolderId
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating todo list:', error);
            return NextResponse.json({ error: `Failed to create todo list: ${error.message}` }, { status: 500 });
        }

        // Add default tasks if configured (skip for "Main" list)
        if (name !== "Main") {
            const { data: defaultTasks } = await supabase
                .from('default_tasks')
                .select('*')
                .eq('project_id', project_id)
                .order('order_index', { ascending: true });

            if (defaultTasks && defaultTasks.length > 0) {
                const itemsToCreate = defaultTasks.map((task, index) => ({
                    todo_list_id: data.id,
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    order_index: index,
                    completed: false
                }));

                await supabase.from('todo_items').insert(itemsToCreate);
            }

            return NextResponse.json({
                ...data,
                items_count: defaultTasks?.length || 0,
                completed_count: 0
            }, { status: 201 });
        }

        // Main list doesn't get default tasks
        return NextResponse.json({
            ...data,
            items_count: 0,
            completed_count: 0
        }, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/todos:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/todos - Update todo list
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { id, name } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing todo list id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('todo_lists')
            .update({ name, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating todo list:', error);
            return NextResponse.json({ error: 'Failed to update todo list' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/todos:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/todos - Delete todo list
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const deleteFolder = searchParams.get('deleteFolder') === 'true';

        if (!id) {
            return NextResponse.json({ error: 'Missing todo list id' }, { status: 400 });
        }

        // Get folder_id before deleting
        const { data: listData } = await supabase
            .from('todo_lists')
            .select('folder_id')
            .eq('id', id)
            .single();

        const { error } = await supabase
            .from('todo_lists')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting todo list:', error);
            return NextResponse.json({ error: 'Failed to delete todo list' }, { status: 500 });
        }

        // Optionally delete the folder too
        if (deleteFolder && listData?.folder_id) {
            await supabase
                .from('project_folders')
                .delete()
                .eq('id', listData.folder_id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/todos:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
