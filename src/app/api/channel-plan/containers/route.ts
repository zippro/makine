import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/channel-plan/containers - List all containers
export async function GET() {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('channel_plan_containers')
            .select(`
                *,
                channel_plan_items(id, completed)
            `)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Error fetching containers:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        // Transform to add computed counts
        const containersWithCounts = (data || []).map(container => ({
            ...container,
            items_count: container.channel_plan_items?.length || 0,
            completed_count: container.channel_plan_items?.filter((t: any) => t.completed).length || 0,
            channel_plan_items: undefined
        }));

        return NextResponse.json(containersWithCounts);
    } catch (error) {
        console.error('Error in GET /api/channel-plan/containers:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/channel-plan/containers - Create new container
export async function POST(request: NextRequest) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();
        const body = await request.json();
        const { name, description, status = 'planned' } = body;

        if (!name) {
            return NextResponse.json({ error: 'Missing name' }, { status: 400 });
        }

        // Get max order_index
        const { data: existing, error: fetchError } = await supabase
            .from('channel_plan_containers')
            .select('order_index')
            .order('order_index', { ascending: false })
            .limit(1);

        if (fetchError) {
            console.error('Error fetching containers:', fetchError);
            if (fetchError.message.includes('does not exist') || fetchError.code === '42P01') {
                return NextResponse.json({
                    error: 'Database migration required. Please run 003_channel_plan.sql in Supabase SQL Editor.',
                    details: fetchError.message
                }, { status: 500 });
            }
            return NextResponse.json({ error: `DB Error: ${fetchError.message}` }, { status: 500 });
        }

        const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

        const { data, error } = await supabase
            .from('channel_plan_containers')
            .insert({
                name,
                description,
                status,
                order_index: nextOrder
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating container:', error);
            if (error.message.includes('does not exist') || error.code === '42P01') {
                return NextResponse.json({
                    error: 'Database migration required. Please run 003_channel_plan.sql in Supabase SQL Editor.',
                    details: error.message
                }, { status: 500 });
            }
            return NextResponse.json({ error: `Failed to create container: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({
            ...data,
            items_count: 0,
            completed_count: 0
        }, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/channel-plan/containers:', error);
        return NextResponse.json({ error: `Internal server error: ${(error as Error).message}` }, { status: 500 });
    }
}

// PATCH /api/channel-plan/containers - Update container or reorder
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();

        // Handle batch reorder
        if (body.reorder && Array.isArray(body.items)) {
            const promises = body.items.map((item: { id: string; order_index: number }) =>
                supabase
                    .from('channel_plan_containers')
                    .update({ order_index: item.order_index })
                    .eq('id', item.id)
            );

            await Promise.all(promises);
            return NextResponse.json({ success: true });
        }

        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing container id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('channel_plan_containers')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating container:', error);
            return NextResponse.json({ error: 'Failed to update container' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/channel-plan/containers:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/channel-plan/containers - Delete container
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing container id' }, { status: 400 });
        }

        const { error } = await supabase
            .from('channel_plan_containers')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting container:', error);
            return NextResponse.json({ error: 'Failed to delete container' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/channel-plan/containers:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
