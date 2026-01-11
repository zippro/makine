import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/todos/defaults - Get default tasks for a project
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
            .from('default_tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Error fetching default tasks:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Error in GET /api/todos/defaults:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/todos/defaults - Add default task
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { project_id, title, description, priority = 'medium' } = body;

        if (!project_id || !title) {
            return NextResponse.json({ error: 'Missing project_id or title' }, { status: 400 });
        }

        // Get max order_index
        const { data: existing } = await supabase
            .from('default_tasks')
            .select('order_index')
            .eq('project_id', project_id)
            .order('order_index', { ascending: false })
            .limit(1);

        const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

        const { data, error } = await supabase
            .from('default_tasks')
            .insert({
                project_id,
                title,
                description,
                priority,
                order_index: nextOrder
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating default task:', error);
            return NextResponse.json({ error: 'Failed to create default task' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/todos/defaults:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/todos/defaults - Update default task or reorder
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { id, ...updates } = body;

        // Handle batch reorder
        if (body.reorder && Array.isArray(body.items)) {
            const promises = body.items.map((item: { id: string; order_index: number }) =>
                supabase
                    .from('default_tasks')
                    .update({ order_index: item.order_index })
                    .eq('id', item.id)
            );

            await Promise.all(promises);
            return NextResponse.json({ success: true });
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('default_tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating default task:', error);
            return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/todos/defaults:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/todos/defaults - Delete default task
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
        }

        const { error } = await supabase
            .from('default_tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting default task:', error);
            return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/todos/defaults:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
