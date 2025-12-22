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
                status: 'processing' // Immediate visual feedback
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

        // Create a new modification job for the local worker
        // 1. Fetch the most recent video job for this animation to get the audio_url and other props
        const { data: previousJob, error: prevJobError } = await supabase
            .from('video_jobs')
            .select('audio_url, image_url, title_text')
            .eq('animation_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Fallback for audio_url if no previous job found (should be rare if created via this tool)
        // If it's missing, we might need a default or error, but let's try to proceed if possible.
        const audioUrl = previousJob?.audio_url;

        if (!audioUrl) {
            console.log('No audio_url found for animation. Job will be created without audio (Silent).');
        }

        const { error: jobError } = await supabase.from('video_jobs').insert({
            project_id: animation.project_id,
            animation_id: id,
            status: 'queued',
            title_text: `Modify: ${animation.title_text || previousJob?.title_text || 'Untitled'}`,
            assets: [
                {
                    type: 'video',
                    url: animation.url, // Original video as source
                    duration: animation.duration_seconds
                }
            ],
            speed_multiplier: speed_multiplier || 1,
            trim_start: trim_start || 0,
            trim_end: trim_end || 0,
            // Fallback chain: animation.image_url (if exists) -> previousJob -> animation.thumbnail_url -> placeholder
            image_url: animation.image_url || previousJob?.image_url || animation.thumbnail_url || 'https://placehold.co/600x400?text=No+Image',
            audio_url: audioUrl
        });

        if (jobError) {
            console.error('Error creating modification job:', jobError);
            return NextResponse.json(
                { error: 'Failed to queue modification job' },
                { status: 500 }
            );
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
