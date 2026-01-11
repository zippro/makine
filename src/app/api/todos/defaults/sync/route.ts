import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/todos/defaults/sync - Add a task to all existing todo lists
export async function POST(request: NextRequest) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();
        const body = await request.json();
        const { project_id, task } = body;

        if (!project_id || !task?.title) {
            return NextResponse.json({ error: 'Missing project_id or task' }, { status: 400 });
        }

        // Get all todo lists for this project
        const { data: lists, error: listsError } = await supabase
            .from('todo_lists')
            .select('id')
            .eq('project_id', project_id);

        if (listsError) {
            console.error('Error fetching lists:', listsError);
            return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
        }

        if (!lists || lists.length === 0) {
            return NextResponse.json({ syncedCount: 0, message: 'No lists to sync' });
        }

        // For each list, get the max order_index and add the task
        let syncedCount = 0;
        const errors: string[] = [];

        for (const list of lists) {
            try {
                // Get max order_index for this list
                const { data: existing } = await supabase
                    .from('todo_items')
                    .select('order_index')
                    .eq('todo_list_id', list.id)
                    .order('order_index', { ascending: false })
                    .limit(1);

                const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

                // Insert the new task
                const { error: insertError } = await supabase
                    .from('todo_items')
                    .insert({
                        todo_list_id: list.id,
                        title: task.title,
                        description: task.description || null,
                        priority: task.priority || 'medium',
                        order_index: nextOrder,
                        completed: false
                    });

                if (insertError) {
                    errors.push(`List ${list.id}: ${insertError.message}`);
                } else {
                    syncedCount++;
                }
            } catch (err) {
                errors.push(`List ${list.id}: ${(err as Error).message}`);
            }
        }

        console.log(`Synced task "${task.title}" to ${syncedCount}/${lists.length} lists`);

        return NextResponse.json({
            success: true,
            syncedCount,
            totalLists: lists.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error in POST /api/todos/defaults/sync:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}
