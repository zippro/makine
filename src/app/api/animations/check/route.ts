import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getVideoStatus } from '@/lib/ai';

export const dynamic = 'force-dynamic';

// POST /api/animations/check - Check Fal.ai status for processing animations
// Called by frontend polling to track async video generation
export async function POST(request: NextRequest) {
    const supabase = createAdminClient();

    try {
        const body = await request.json();
        const { animation_id } = body;

        if (!animation_id) {
            return NextResponse.json({ error: 'Missing animation_id' }, { status: 400 });
        }

        // Get animation with its fal_request_id
        const { data: animation, error: fetchError } = await supabase
            .from('animations')
            .select('id, status, fal_request_id')
            .eq('id', animation_id)
            .single();

        if (fetchError || !animation) {
            return NextResponse.json({ error: 'Animation not found' }, { status: 404 });
        }

        // Only check if still processing and has a request_id
        if (animation.status !== 'processing' || !animation.fal_request_id) {
            return NextResponse.json({ status: animation.status, checked: false });
        }

        // Check Fal.ai status (single call, no polling loop)
        try {
            const result = await getVideoStatus(animation.fal_request_id);

            if (result.status === 'COMPLETED' && result.videoUrl) {
                console.log(`[Animation Check] ${animation_id} completed! URL: ${result.videoUrl}`);
                await supabase
                    .from('animations')
                    .update({
                        status: 'done',
                        url: result.videoUrl,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', animation_id);

                return NextResponse.json({ status: 'done', video_url: result.videoUrl, checked: true });
            } else if (result.status === 'FAILED') {
                console.log(`[Animation Check] ${animation_id} failed: ${result.error}`);
                await supabase
                    .from('animations')
                    .update({
                        status: 'error',
                        error_message: result.error || 'Video generation failed',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', animation_id);

                return NextResponse.json({ status: 'error', error: result.error, checked: true });
            } else {
                // Still processing — update the heartbeat timestamp so auto-cleanup doesn't kill it
                console.log(`[Animation Check] ${animation_id} still ${result.status}`);
                await supabase
                    .from('animations')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', animation_id);

                return NextResponse.json({ status: 'processing', fal_status: result.status, checked: true });
            }
        } catch (checkError) {
            console.error(`[Animation Check] Error checking ${animation_id}:`, checkError);
            // Don't mark as error on transient check failures — just update heartbeat
            await supabase
                .from('animations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', animation_id);

            return NextResponse.json({
                status: 'processing',
                check_error: checkError instanceof Error ? checkError.message : 'Unknown',
                checked: true,
            });
        }
    } catch (error) {
        console.error('Error in POST /api/animations/check:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
