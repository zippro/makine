import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/animations - List all animations for a project
export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        const { data: animations, error } = await supabase
            .from('animations')
            .select(`
                *,
                images (
                    id,
                    url,
                    filename
                )
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching animations:', error);
            return NextResponse.json(
                { error: 'Failed to fetch animations' },
                { status: 500 }
            );
        }

        return NextResponse.json(animations);
    } catch (error) {
        console.error('Error in GET /api/animations:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH /api/animations - Update an animation
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { id, is_approved, trim_start, trim_end, speed_multiplier, url, status, error_message } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Missing animation id' },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (is_approved !== undefined) updateData.is_approved = is_approved;
        if (trim_start !== undefined) updateData.trim_start = trim_start;
        if (trim_end !== undefined) updateData.trim_end = trim_end;
        if (speed_multiplier !== undefined) updateData.speed_multiplier = speed_multiplier;
        if (url !== undefined) updateData.url = url;
        if (status !== undefined) updateData.status = status;
        if (error_message !== undefined) updateData.error_message = error_message;
        const { folder } = body;
        if (folder !== undefined) updateData.folder = folder;

        const { data, error } = await supabase
            .from('animations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating animation:', error);
            return NextResponse.json(
                { error: 'Failed to update animation' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/animations:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/animations - Delete an animation
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Missing animation id' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('animations')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting animation:', error);
            return NextResponse.json(
                { error: 'Failed to delete animation' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/animations:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
