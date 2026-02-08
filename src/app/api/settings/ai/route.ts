import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/settings/ai - Get global AI settings
export async function GET() {
    try {
        const supabase = createAdminClient();

        const { data: settings, error } = await supabase
            .from('ai_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching AI settings:', error);
            // Return defaults if no settings exist
            return NextResponse.json({
                vlm_provider: 'openai',
                vlm_model: 'gpt-4o',
                vlm_api_url: 'https://api.openai.com/v1/chat/completions',
                video_provider: 'fal-kling',
                video_model: 'kling-video-o1',
                video_api_url: 'https://queue.fal.run/fal-ai/kling-video/o1/image-to-video',
                video_status_url: 'https://queue.fal.run/fal-ai/kling-video/requests',
                default_duration: 10,
                poll_interval_ms: 15000,
                max_poll_attempts: 40,
                animation_system_prompt: 'You are an expert VLM. You analyze images to create video generation prompts.',
                animation_user_prompt: 'Look at this image. Write a single prompt for Kling AI to generate a SEAMLESS LOOP animation based on this image.\n\nUSER CONTEXT: {user_prompt}\n\nCRITICAL REQUIREMENTS:\n1. **Loop**: The animation must be a consecutive loop (start frame = end frame).\n2. **Camera**: STATIC CAMERA ONLY. No pan, no zoom, no tilt.\n3. **Motion**: Only small, internal effects (wind, fog, water flow, breathing).\n4. **Output**: A single comma-separated string suitable for image-to-video generation.\n\nAnalyze the subject and depth. Describe the scene and specify subtle motions.',
            });
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error in GET /api/settings/ai:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH /api/settings/ai - Update global AI settings
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();

        // Get existing settings ID
        const { data: existing } = await supabase
            .from('ai_settings')
            .select('id')
            .limit(1)
            .single();

        if (!existing) {
            return NextResponse.json(
                { error: 'AI settings not found' },
                { status: 404 }
            );
        }

        // Build update object with only allowed fields
        const allowedFields = [
            'vlm_provider',
            'vlm_model',
            'vlm_api_url',
            'video_provider',
            'video_model',
            'video_api_url',
            'video_status_url',
            'default_duration',
            'poll_interval_ms',
            'max_poll_attempts',
            'animation_system_prompt',
            'animation_user_prompt',
        ];

        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        const { data, error } = await supabase
            .from('ai_settings')
            .update(updateData)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating AI settings:', error);
            return NextResponse.json(
                { error: 'Failed to update AI settings' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in PATCH /api/settings/ai:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
