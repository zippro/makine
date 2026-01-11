import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/animations/generate - Trigger animation generation for an image
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { animation_id, image_url, duration, prompt, animation_prompt } = body;

        if (!animation_id || !image_url) {
            return NextResponse.json(
                { error: 'Missing required fields: animation_id, image_url' },
                { status: 400 }
            );
        }

        // Trigger n8n webhook for animation generation
        const n8nAnimationWebhookUrl = process.env.N8N_ANIMATION_WEBHOOK_URL;
        if (n8nAnimationWebhookUrl) {
            try {
                await fetch(n8nAnimationWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        animation_id,
                        image_url,
                        duration: duration || 10,
                        prompt,
                        animation_prompt, // Pass the system prompt template
                    }),
                });
            } catch (webhookError) {
                console.error('Error triggering n8n animation webhook:', webhookError);
            }
        } else {
            console.warn('N8N_ANIMATION_WEBHOOK_URL not configured');
        }

        return NextResponse.json({ success: true, animation_id }, { status: 200 });
    } catch (error) {
        console.error('Error in POST /api/animations/generate:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
