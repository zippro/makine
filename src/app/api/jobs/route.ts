import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/jobs - Create a new video job
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Try to get current user (optional - public access allowed)
        const { data: { user } } = await supabase.auth.getUser();

        // Parse request body
        const body = await request.json();

        const { animation_id, music_ids, title_text, project_id } = body;

        // Validate required fields
        if (!animation_id) {
            return NextResponse.json(
                { error: 'Missing required field: animation_id' },
                { status: 400 }
            );
        }
        if (!music_ids || !Array.isArray(music_ids) || music_ids.length === 0) {
            return NextResponse.json(
                { error: 'Missing required field: music_ids (array)' },
                { status: 400 }
            );
        }
        if (!title_text) {
            return NextResponse.json(
                { error: 'Missing required field: title_text' },
                { status: 400 }
            );
        }
        if (!project_id) {
            return NextResponse.json(
                { error: 'Missing required field: project_id' },
                { status: 400 }
            );
        }

        // Validate title length
        if (title_text.length > 100) {
            return NextResponse.json(
                { error: 'Title must be less than 100 characters' },
                { status: 400 }
            );
        }

        // Get animation details
        const { data: animation, error: animError } = await supabase
            .from('animations')
            .select('url')
            .eq('id', animation_id)
            .single();

        if (animError || !animation) {
            return NextResponse.json(
                { error: 'Animation not found' },
                { status: 404 }
            );
        }

        // Get music details
        const { data: musicTracks, error: musicError } = await supabase
            .from('music_library')
            .select('id, url, duration_seconds')
            .in('id', music_ids);

        if (musicError || !musicTracks || musicTracks.length === 0) {
            return NextResponse.json(
                { error: 'Music tracks not found' },
                { status: 404 }
            );
        }

        // Order music tracks according to music_ids order
        const orderedMusic = music_ids.map((id: string) => musicTracks.find(t => t.id === id)).filter(Boolean);

        // Create the job
        const { data: job, error: insertError } = await supabase
            .from('video_jobs')
            .insert({
                user_id: user?.id || null,
                animation_id,
                title_text,
                project_id,
                status: 'queued',
                // Keep legacy fields for compatibility
                image_url: animation.url,
                audio_url: orderedMusic[0]?.url || '',
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creating job:', insertError);
            return NextResponse.json(
                { error: 'Failed to create job' },
                { status: 500 }
            );
        }

        // Create video_music junction records
        for (let i = 0; i < music_ids.length; i++) {
            await supabase
                .from('video_music')
                .insert({
                    video_job_id: job.id,
                    music_id: music_ids[i],
                    order_index: i,
                });
        }

        // Update animation usage count
        await supabase.rpc('increment_animation_usage', { anim_id: animation_id });

        // Update music usage counts
        for (const musicId of music_ids) {
            await supabase.rpc('increment_music_usage', { mus_id: musicId });
        }

        // Trigger n8n webhook to start processing
        // const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        // if (n8nWebhookUrl) {
        //     try {
        //         await fetch(n8nWebhookUrl, {
        //             method: 'POST',
        //             headers: { 'Content-Type': 'application/json' },
        //             body: JSON.stringify({
        //                 job_id: job.id,
        //                 animation_url: animation.url,
        //                 music_urls: orderedMusic.filter(Boolean).map((t) => t!.url),
        //                 music_durations: orderedMusic.filter(Boolean).map((t) => t!.duration_seconds || 0),
        //                 title_text: title_text,
        //                 title_appear_at: 7, // Text appears at 7 seconds
        //             }),
        //         });
        //     } catch (webhookError) {
        //         console.error('Error triggering n8n webhook:', webhookError);
        //     }
        // }

        return NextResponse.json(job, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/jobs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/jobs - List all jobs for a project
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        // Fetch all jobs with animation and music details
        const { data: jobs, error: fetchError } = await supabase
            .from('video_jobs')
            .select(`
                *,
                animations (
                    id,
                    url,
                    duration
                )
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('Error fetching jobs:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch jobs' },
                { status: 500 }
            );
        }

        return NextResponse.json(jobs);
    } catch (error) {
        console.error('Error in GET /api/jobs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
