import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/images - Create new image entry
export async function POST(request: NextRequest) {
    try {
        // Use Admin Client to bypass RLS in Dev Mode
        const supabase = createAdminClient();
        const body = await request.json();
        const { url, filename, file_size, width, height, project_id } = body;

        if (!url || !filename || !project_id) {
            return NextResponse.json(
                { error: 'Missing required fields: url, filename, project_id' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('images')
            .insert({
                url,
                filename,
                file_size,
                width,
                height,
                project_id
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating image:', error);
            return NextResponse.json(
                { error: 'Failed to create image entry' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/images:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/images - List images for a project
export async function GET(request: NextRequest) {
    try {
        // Use Admin Client to bypass RLS for reading images in Dev Mode
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        const { data: images, error } = await supabase
            .from('images')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching images:', error);
            return NextResponse.json(
                { error: 'Failed to fetch images' },
                { status: 500 }
            );
        }

        return NextResponse.json(images);
    } catch (error) {
        console.error('Error in GET /api/images:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
// PATCH /api/images - Update image details (e.g. move to folder)
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { id, folder, project_id } = body;

        if (!id || !project_id) {
            return NextResponse.json({ error: 'ID and Project ID required' }, { status: 400 });
        }

        const updates: any = {};
        if (folder !== undefined) updates.folder = folder;

        const { data, error } = await supabase
            .from('images')
            .update(updates)
            .eq('id', id)
            .eq('project_id', project_id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
