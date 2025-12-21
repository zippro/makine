import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/folders - List folders for a project
// GET /api/folders - List folders for a project
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
            .from('project_folders')
            .select('*')
            .eq('project_id', projectId)
            .order('path', { ascending: true });

        if (error) {
            console.error('Error fetching folders:', error);
            return NextResponse.json({ error: `DB Error: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in GET /api/folders:', error);
        return NextResponse.json({ error: `Internal Error: ${(error as Error).message}` }, { status: 500 });
    }
}

// POST /api/folders - Create new folder
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient(); // Admin client to verify project access? Or just client. 
        // Using Admin for simplicity in MVP, but ideally should verify user.
        const body = await request.json();
        const { project_id, path } = body;

        if (!project_id || !path) {
            return NextResponse.json({ error: 'Missing project_id or path' }, { status: 400 });
        }

        // Check if exists
        const { data: existing } = await supabase
            .from('project_folders')
            .select('id')
            .eq('project_id', project_id)
            .eq('path', path)
            .single();

        if (existing) {
            return NextResponse.json(existing); // Return existing if duplicate
        }

        const { data, error } = await supabase
            .from('project_folders')
            .insert({ project_id, path })
            .select()
            .single();

        if (error) {
            console.error('Error creating folder:', error);
            return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/folders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
