import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/dev-plan/versions - List all versions
export async function GET() {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('dev_plan_versions')
            .select(`
                *,
                dev_plan_tasks(id, completed)
            `)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Error fetching versions:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        // Transform to add computed counts
        const versionsWithCounts = (data || []).map(version => ({
            ...version,
            tasks_count: version.dev_plan_tasks?.length || 0,
            completed_count: version.dev_plan_tasks?.filter((t: any) => t.completed).length || 0,
            dev_plan_tasks: undefined
        }));

        return NextResponse.json(versionsWithCounts);
    } catch (error) {
        console.error('Error in GET /api/dev-plan/versions:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/dev-plan/versions - Create new version
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
            .from('dev_plan_versions')
            .select('order_index')
            .order('order_index', { ascending: false })
            .limit(1);

        if (fetchError) {
            console.error('Error fetching versions:', fetchError);
            // Check if table doesn't exist
            if (fetchError.message.includes('does not exist') || fetchError.code === '42P01') {
                return NextResponse.json({
                    error: 'Database migration required. Please run 002_dev_plan.sql in Supabase SQL Editor.',
                    details: fetchError.message
                }, { status: 500 });
            }
            return NextResponse.json({ error: `DB Error: ${fetchError.message}` }, { status: 500 });
        }

        const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

        const { data, error } = await supabase
            .from('dev_plan_versions')
            .insert({
                name,
                description,
                status,
                order_index: nextOrder
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating version:', error);
            if (error.message.includes('does not exist') || error.code === '42P01') {
                return NextResponse.json({
                    error: 'Database migration required. Please run 002_dev_plan.sql in Supabase SQL Editor.',
                    details: error.message
                }, { status: 500 });
            }
            return NextResponse.json({ error: `Failed to create version: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({
            ...data,
            tasks_count: 0,
            completed_count: 0
        }, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/dev-plan/versions:', error);
        return NextResponse.json({ error: `Internal server error: ${(error as Error).message}` }, { status: 500 });
    }
}

// PATCH /api/dev-plan/versions - Update version or reorder
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();

        // Handle batch reorder
        if (body.reorder && Array.isArray(body.items)) {
            const promises = body.items.map((item: { id: string; order_index: number }) =>
                supabase
                    .from('dev_plan_versions')
                    .update({ order_index: item.order_index })
                    .eq('id', item.id)
            );

            await Promise.all(promises);
            return NextResponse.json({ success: true });
        }

        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing version id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('dev_plan_versions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating version:', error);
            return NextResponse.json({ error: 'Failed to update version' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/dev-plan/versions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/dev-plan/versions - Delete version
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing version id' }, { status: 400 });
        }

        const { error } = await supabase
            .from('dev_plan_versions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting version:', error);
            return NextResponse.json({ error: 'Failed to delete version' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/dev-plan/versions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
