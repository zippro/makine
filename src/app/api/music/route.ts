import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/music - List all music for a project
export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        const { data: music, error } = await supabase
            .from('music_library')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching music:', error);
            return NextResponse.json(
                { error: 'Failed to fetch music' },
                { status: 500 }
            );
        }

        return NextResponse.json(music);
    } catch (error) {
        console.error('Error in GET /api/music:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/music - Create new music entry
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { url, filename, file_size, duration_seconds, project_id, folder } = body;

        if (!url || !filename || !project_id) {
            return NextResponse.json(
                { error: 'Missing required fields: url, filename, project_id' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('music_library')
            .insert({
                url,
                filename,
                file_size,
                duration_seconds,
                project_id,
                folder: folder || '/',
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating music:', error);
            return NextResponse.json(
                { error: 'Failed to create music entry' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/music:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH /api/music - Update music entry (e.g. folder)
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { id, folder } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing music id' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (folder !== undefined) updateData.folder = folder;

        const { data, error } = await supabase
            .from('music_library')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating music:', error);
            return NextResponse.json({ error: 'Failed to update music' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/music:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/music - Delete a music entry
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Missing music id' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('music_library')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting music:', error);
            return NextResponse.json(
                { error: 'Failed to delete music' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/music:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
