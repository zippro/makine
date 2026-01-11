import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/profile - Get current user's profile
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const adminSupabase = createAdminClient();

        // Get or create profile
        let { data: profile, error } = await adminSupabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Profile doesn't exist, create one
            const { data: newProfile, error: createError } = await adminSupabase
                .from('user_profiles')
                .insert({
                    user_id: user.id,
                    email: user.email,
                    nickname: null
                })
                .select()
                .single();

            if (createError) {
                console.error('Error creating profile:', createError);
                return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
            }
            profile = newProfile;
        } else if (error) {
            console.error('Error fetching profile:', error);
            return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Error in GET /api/profile:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/profile - Update profile (nickname)
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { nickname } = body;

        if (nickname !== undefined && nickname !== null) {
            // Validate nickname: alphanumeric, no spaces, 2-20 chars
            const nicknameRegex = /^[a-zA-Z0-9_]{2,20}$/;
            if (!nicknameRegex.test(nickname)) {
                return NextResponse.json({
                    error: 'Nickname must be 2-20 characters, alphanumeric or underscore only'
                }, { status: 400 });
            }
        }

        const adminSupabase = createAdminClient();

        // Check if nickname is taken by someone else
        if (nickname) {
            const { data: existing } = await adminSupabase
                .from('user_profiles')
                .select('id')
                .eq('nickname', nickname.toLowerCase())
                .neq('user_id', user.id)
                .single();

            if (existing) {
                return NextResponse.json({ error: 'Nickname already taken' }, { status: 400 });
            }
        }

        // Upsert profile
        const { data: profile, error } = await adminSupabase
            .from('user_profiles')
            .upsert({
                user_id: user.id,
                email: user.email,
                nickname: nickname?.toLowerCase() || null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Error in PATCH /api/profile:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
