import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/todos/items - Get items for a todo list
export async function GET(request: NextRequest) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const listId = searchParams.get('listId');

        if (!listId) {
            return NextResponse.json({ error: 'List ID required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('todo_items')
            .select('*')
            .eq('todo_list_id', listId)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Error fetching todo items:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Error in GET /api/todos/items:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/todos/items - Create new item
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { todo_list_id, title, description, priority = 'medium', due_date } = body;

        if (!todo_list_id || !title) {
            return NextResponse.json({ error: 'Missing todo_list_id or title' }, { status: 400 });
        }

        // Get max order_index for this list
        const { data: existing } = await supabase
            .from('todo_items')
            .select('order_index')
            .eq('todo_list_id', todo_list_id)
            .order('order_index', { ascending: false })
            .limit(1);

        const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

        const { data, error } = await supabase
            .from('todo_items')
            .insert({
                todo_list_id,
                title,
                description,
                priority,
                due_date,
                order_index: nextOrder,
                completed: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating todo item:', error);
            return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/todos/items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/todos/items - Update item
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
        }

        // Handle batch reorder
        if (body.reorder && Array.isArray(body.items)) {
            const promises = body.items.map((item: { id: string; order_index: number }) =>
                supabase
                    .from('todo_items')
                    .update({ order_index: item.order_index, updated_at: new Date().toISOString() })
                    .eq('id', item.id)
            );

            await Promise.all(promises);
            return NextResponse.json({ success: true });
        }

        // Single item update
        const { data, error } = await supabase
            .from('todo_items')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating todo item:', error);
            return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/todos/items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/todos/items - Delete item
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
        }

        const { error } = await supabase
            .from('todo_items')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting todo item:', error);
            return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/todos/items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
