import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/profile/mentions - Get todo items mentioning the user
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const adminSupabase = createAdminClient();

        // Get user's nickname
        const { data: profile } = await adminSupabase
            .from('user_profiles')
            .select('nickname')
            .eq('user_id', user.id)
            .single();

        if (!profile?.nickname) {
            return NextResponse.json({ items: [], message: 'Set a nickname to see your mentions' });
        }

        const mentionPattern = `@${profile.nickname}`;

        // Find todo items mentioning this user (in title or description)
        const { data: items, error } = await adminSupabase
            .from('todo_items')
            .select(`
                *,
                todo_lists (
                    id,
                    name,
                    project_id,
                    projects:project_id (
                        id,
                        name
                    )
                )
            `)
            .or(`title.ilike.%${mentionPattern}%,description.ilike.%${mentionPattern}%`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching mentions:', error);
            return NextResponse.json({ error: 'Failed to fetch mentions' }, { status: 500 });
        }

        return NextResponse.json({ items: items || [], nickname: profile.nickname });
    } catch (error) {
        console.error('Error in GET /api/profile/mentions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/profile/mentions - Toggle completion of a mentioned item
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { item_id, completed } = body;

        if (!item_id || completed === undefined) {
            return NextResponse.json({ error: 'item_id and completed required' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // Update the todo item (this updates the main todo list too since it's the same record)
        const { data: item, error } = await adminSupabase
            .from('todo_items')
            .update({
                completed,
                updated_at: new Date().toISOString()
            })
            .eq('id', item_id)
            .select()
            .single();

        if (error) {
            console.error('Error updating item:', error);
            return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
        }

        return NextResponse.json(item);
    } catch (error) {
        console.error('Error in PATCH /api/profile/mentions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
