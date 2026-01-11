import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/folders - List folders for a project
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

        const { data, error } = await supabase
            .from('project_folders')
            .select('*')
            .eq('project_id', projectId)
            .order('path', { ascending: true });

        if (error) {
            console.error('Error fetching folders:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in GET /api/folders:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/folders - Create new folder (and auto-create todo list)
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { project_id, path, skip_todo_list } = body;

        if (!project_id || !path) {
            return NextResponse.json({ error: 'Missing project_id or path' }, { status: 400 });
        }

        // Check if exists
        const { data: existing } = await supabase
            .from('project_folders')
            .select('id')
            .eq('project_id', project_id)
            .eq('path', path)
            .single();

        if (existing) {
            return NextResponse.json(existing); // Return existing if duplicate
        }

        const { data, error } = await supabase
            .from('project_folders')
            .insert({ project_id, path })
            .select()
            .single();

        if (error) {
            console.error('Error creating folder:', error);
            return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
        }

        // Auto-create todo list for this folder (unless skipped)
        if (!skip_todo_list) {
            try {
                // Create todo list linked to this folder
                const { data: todoList } = await supabase
                    .from('todo_lists')
                    .insert({
                        project_id,
                        name: path,
                        folder_id: data.id
                    })
                    .select()
                    .single();

                // If todo list created, add default tasks
                if (todoList) {
                    const { data: defaultTasks } = await supabase
                        .from('default_tasks')
                        .select('*')
                        .eq('project_id', project_id)
                        .order('order_index', { ascending: true });

                    if (defaultTasks && defaultTasks.length > 0) {
                        const itemsToCreate = defaultTasks.map((task, index) => ({
                            todo_list_id: todoList.id,
                            title: task.title,
                            description: task.description,
                            priority: task.priority,
                            order_index: index,
                            completed: false
                        }));

                        await supabase.from('todo_items').insert(itemsToCreate);
                    }
                }
            } catch (todoError) {
                // Log but don't fail folder creation if todo list fails
                console.error('Error auto-creating todo list:', todoError);
            }
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/folders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/folders - Delete a folder (moves items to root)
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get('id');

        if (!folderId) {
            return NextResponse.json({ error: 'Folder ID required' }, { status: 400 });
        }

        // Get folder path first
        const { data: folder, error: fetchError } = await supabase
            .from('project_folders')
            .select('path, project_id')
            .eq('id', folderId)
            .single();

        if (fetchError || !folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        const folderPath = folder.path;
        const folderProjectId = folder.project_id;

        // Move animations in this folder to root
        await supabase
            .from('animations')
            .update({ folder: '/' })
            .eq('project_id', folderProjectId)
            .eq('folder', folderPath);

        // Move animations in subfolders to root
        await supabase
            .from('animations')
            .update({ folder: '/' })
            .eq('project_id', folderProjectId)
            .like('folder', `${folderPath}/%`);

        // Move music in this folder to root
        await supabase
            .from('music_library')
            .update({ folder: '/' })
            .eq('project_id', folderProjectId)
            .eq('folder', folderPath);

        // Move music in subfolders to root
        await supabase
            .from('music_library')
            .update({ folder: '/' })
            .eq('project_id', folderProjectId)
            .like('folder', `${folderPath}/%`);

        // Delete subfolders
        await supabase
            .from('project_folders')
            .delete()
            .eq('project_id', folderProjectId)
            .like('path', `${folderPath}/%`);

        // Delete the folder itself
        const { error: deleteError } = await supabase
            .from('project_folders')
            .delete()
            .eq('id', folderId);

        if (deleteError) {
            console.error('Error deleting folder:', deleteError);
            return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/folders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/folders - Rename a folder
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { id, new_name } = body;

        if (!id || !new_name) {
            return NextResponse.json({ error: 'Folder ID and new_name required' }, { status: 400 });
        }

        // Get current folder
        const { data: folder, error: fetchError } = await supabase
            .from('project_folders')
            .select('path, project_id')
            .eq('id', id)
            .single();

        if (fetchError || !folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        const oldPath = folder.path;
        const projectId = folder.project_id;

        // Calculate new path (keep parent, change last segment)
        const pathParts = oldPath.split('/').filter(Boolean);
        pathParts[pathParts.length - 1] = new_name;
        const newPath = '/' + pathParts.join('/');

        // Check if new path already exists
        const { data: existing } = await supabase
            .from('project_folders')
            .select('id')
            .eq('project_id', projectId)
            .eq('path', newPath)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 400 });
        }

        // Update folder path
        const { error: updateError } = await supabase
            .from('project_folders')
            .update({ path: newPath })
            .eq('id', id);

        if (updateError) {
            console.error('Error updating folder:', updateError);
            return NextResponse.json({ error: 'Failed to rename folder' }, { status: 500 });
        }

        // Update animations in this folder
        await supabase
            .from('animations')
            .update({ folder: newPath })
            .eq('project_id', projectId)
            .eq('folder', oldPath);

        // Update animations in subfolders (replace prefix)
        const { data: animationsInSubfolders } = await supabase
            .from('animations')
            .select('id, folder')
            .eq('project_id', projectId)
            .like('folder', `${oldPath}/%`);

        if (animationsInSubfolders) {
            for (const anim of animationsInSubfolders) {
                const updatedFolder = anim.folder.replace(oldPath, newPath);
                await supabase.from('animations').update({ folder: updatedFolder }).eq('id', anim.id);
            }
        }

        // Update music in this folder
        await supabase
            .from('music_library')
            .update({ folder: newPath })
            .eq('project_id', projectId)
            .eq('folder', oldPath);

        // Update music in subfolders
        const { data: musicInSubfolders } = await supabase
            .from('music_library')
            .select('id, folder')
            .eq('project_id', projectId)
            .like('folder', `${oldPath}/%`);

        if (musicInSubfolders) {
            for (const track of musicInSubfolders) {
                const updatedFolder = track.folder.replace(oldPath, newPath);
                await supabase.from('music_library').update({ folder: updatedFolder }).eq('id', track.id);
            }
        }

        // Update subfolders
        const { data: subfolders } = await supabase
            .from('project_folders')
            .select('id, path')
            .eq('project_id', projectId)
            .like('path', `${oldPath}/%`);

        if (subfolders) {
            for (const subfolder of subfolders) {
                const updatedPath = subfolder.path.replace(oldPath, newPath);
                await supabase.from('project_folders').update({ path: updatedPath }).eq('id', subfolder.id);
            }
        }

        return NextResponse.json({ success: true, path: newPath });
    } catch (error) {
        console.error('Error in PATCH /api/folders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
