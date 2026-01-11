import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/channel-plan/items - Get items for a container
export async function GET(request: NextRequest) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const containerId = searchParams.get('containerId');

        if (!containerId) {
            return NextResponse.json({ error: 'Container ID required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('channel_plan_items')
            .select('*')
            .eq('container_id', containerId)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Error fetching items:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Error in GET /api/channel-plan/items:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/channel-plan/items - Create new item
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { container_id, title, description, priority = 'medium' } = body;

        if (!container_id || !title) {
            return NextResponse.json({ error: 'Missing container_id or title' }, { status: 400 });
        }

        // Get max order_index
        const { data: existing } = await supabase
            .from('channel_plan_items')
            .select('order_index')
            .eq('container_id', container_id)
            .order('order_index', { ascending: false })
            .limit(1);

        const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

        const { data, error } = await supabase
            .from('channel_plan_items')
            .insert({
                container_id,
                title,
                description,
                priority,
                order_index: nextOrder,
                completed: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating item:', error);
            return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/channel-plan/items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/channel-plan/items - Update item or reorder
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();

        // Handle batch reorder
        if (body.reorder && Array.isArray(body.items)) {
            const promises = body.items.map((item: { id: string; order_index: number; container_id?: string }) =>
                supabase
                    .from('channel_plan_items')
                    .update({
                        order_index: item.order_index,
                        ...(item.container_id ? { container_id: item.container_id } : {})
                    })
                    .eq('id', item.id)
            );

            await Promise.all(promises);
            return NextResponse.json({ success: true });
        }

        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('channel_plan_items')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating item:', error);
            return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/channel-plan/items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/channel-plan/items - Delete item
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
        }

        const { error } = await supabase
            .from('channel_plan_items')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting item:', error);
            return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/channel-plan/items:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
