import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/dev-plan/tasks - Get tasks for a version
export async function GET(request: NextRequest) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const versionId = searchParams.get('versionId');

        if (!versionId) {
            return NextResponse.json({ error: 'Version ID required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('dev_plan_tasks')
            .select('*')
            .eq('version_id', versionId)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Error fetching tasks:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Error in GET /api/dev-plan/tasks:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/dev-plan/tasks - Create new task
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { version_id, title, description, priority = 'medium' } = body;

        if (!version_id || !title) {
            return NextResponse.json({ error: 'Missing version_id or title' }, { status: 400 });
        }

        // Get max order_index
        const { data: existing } = await supabase
            .from('dev_plan_tasks')
            .select('order_index')
            .eq('version_id', version_id)
            .order('order_index', { ascending: false })
            .limit(1);

        const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

        const { data, error } = await supabase
            .from('dev_plan_tasks')
            .insert({
                version_id,
                title,
                description,
                priority,
                order_index: nextOrder,
                completed: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating task:', error);
            return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/dev-plan/tasks:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/dev-plan/tasks - Update task or reorder
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();

        // Handle batch reorder
        if (body.reorder && Array.isArray(body.items)) {
            const promises = body.items.map((item: { id: string; order_index: number; version_id?: string }) =>
                supabase
                    .from('dev_plan_tasks')
                    .update({
                        order_index: item.order_index,
                        ...(item.version_id ? { version_id: item.version_id } : {})
                    })
                    .eq('id', item.id)
            );

            await Promise.all(promises);
            return NextResponse.json({ success: true });
        }

        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('dev_plan_tasks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating task:', error);
            return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/dev-plan/tasks:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/dev-plan/tasks - Delete task
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
        }

        const { error } = await supabase
            .from('dev_plan_tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting task:', error);
            return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/dev-plan/tasks:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
