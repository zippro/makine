import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/animations/modify - Trigger FFmpeg modification for an animation
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { id, trim_start, trim_end, speed_multiplier } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Missing animation id' },
                { status: 400 }
            );
        }

        // Update animation parameters in database
        const { data: animation, error: updateError } = await supabase
            .from('animations')
            .update({
                trim_start: trim_start || 0,
                trim_end: trim_end || 0,
                speed_multiplier: speed_multiplier || 1,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating animation:', updateError);
            return NextResponse.json(
                { error: 'Failed to update animation' },
                { status: 500 }
            );
        }

        // Trigger n8n webhook for FFmpeg processing
        const n8nModifyWebhookUrl = process.env.N8N_MODIFY_WEBHOOK_URL;
        if (n8nModifyWebhookUrl && animation.url) {
            try {
                await fetch(n8nModifyWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        animation_id: id,
                        video_url: animation.url,
                        trim_start: trim_start || 0,
                        trim_end: trim_end || 0,
                        speed_multiplier: speed_multiplier || 1,
                    }),
                });
            } catch (webhookError) {
                console.error('Error triggering n8n modify webhook:', webhookError);
            }
        }

        return NextResponse.json(animation);
    } catch (error) {
        console.error('Error in POST /api/animations/modify:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
