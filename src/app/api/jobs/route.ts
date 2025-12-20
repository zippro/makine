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


        // Get project settings for mode/overlays
        // We do this BEFORE validation to know which mode we are in
        const { data: projectData, error: projError } = await supabase
            .from('projects')
            .select('video_mode, template_assets, overlay_config')
            .eq('id', project_id)
            .single();

        const videoMode = projectData?.video_mode || 'simple_animation';
        const templateAssets = projectData?.template_assets || [];
        const overlayConfig = projectData?.overlay_config || { images: [], title: { enabled: true } };

        // Validate Mode-Specific Requirements
        if (videoMode === 'simple_animation') {
            if (!animation_id) {
                return NextResponse.json({ error: 'Missing required field: animation_id' }, { status: 400 });
            }
        } else {
            // Multi/Slideshow
            if (!templateAssets || templateAssets.length === 0) {
                return NextResponse.json({ error: 'Playlist is empty. Add assets in Project Settings.' }, { status: 400 });
            }
            // animation_id is optional/ignored here
        }

        // Validate title length
        if (title_text.length > 100) {
            return NextResponse.json(
                { error: 'Title must be less than 100 characters' },
                { status: 400 }
            );
        }

        // --- ASSET CONSTRUCTION ---
        let assets = [];
        let mainAnimationUrl = '';

        if (videoMode === 'simple_animation' && animation_id) {
            // Get animation details
            const { data: animation, error: animError } = await supabase
                .from('animations')
                .select('url')
                .eq('id', animation_id)
                .single();

            if (animError || !animation) {
                return NextResponse.json({ error: 'Animation not found' }, { status: 404 });
            }
            mainAnimationUrl = animation.url;

            // Simple Mode Asset: One video loop
            assets.push({
                type: 'video',
                url: animation.url,
                start_time: 0,
                duration: null, // Loop for full duration
                loop: true,
                position: 'center'
            });
        }
        else {
            // Multi/Slideshow Assets
            // Map template_assets to job assets
            // Assuming template_assets structure: { type, url, duration }
            let currentTime = 0;
            // logic: we don't strictly set start_time for a looped sequence in the backend usually, 
            // but the worker expects a list.
            // For now, let's pass the raw list as the "playlist" and the worker handles the looping.
            // Or better: Pass them as standard assets. 

            // To support the "Loop" requirement, the worker likely needs a special flag or we just pass the list.
            // Let's copy the template assets directly.
            assets = [...templateAssets];
            // If it's slideshow, ensure type is image
            if (videoMode === 'image_slideshow') {
                assets = assets.map(a => ({ ...a, type: 'image' }));
            }
        }

        // Add Global Overlays (Title)
        if (overlayConfig.title?.enabled) {
            // Ensure timing values are always valid numbers
            const titleStartTime = Number(overlayConfig.title.start_time) || 0;
            const titleDuration = Number(overlayConfig.title.duration) || 5;

            assets.push({
                type: 'text',
                content: title_text,
                start_time: titleStartTime,
                duration: titleDuration,
                position: overlayConfig.title.position || 'center',
                font: overlayConfig.title.font || 'Arial',
                style: {
                    fontSize: overlayConfig.title.fontSize || 60,
                    color: 'white',
                    shadow: true
                },
                is_overlay: true
            });
        }

        // Add Global Overlays (Images)
        if (overlayConfig.images && Array.isArray(overlayConfig.images)) {
            assets.push(...overlayConfig.images.map((img: any) => ({
                type: 'image',
                url: img.url,
                start_time: img.start_time || 0,
                duration: img.duration || 5,
                position: img.position || 'center',
                is_overlay: true // explicit flag if needed
            })));
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
                animation_id: videoMode === 'simple_animation' ? animation_id : null,
                title_text,
                project_id,
                status: 'pending', // Set to pending initially to avoid race condition with worker
                // Legacy fields shim
                image_url: mainAnimationUrl || (assets[0]?.url) || '',
                audio_url: orderedMusic[0]?.url || '',
                // NEW: Save the full assets logic
                assets: assets
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

        // Update usage counts
        if (animation_id) {
            await supabase.rpc('increment_animation_usage', { anim_id: animation_id });
        }
        for (const musicId of music_ids) {
            await supabase.rpc('increment_music_usage', { mus_id: musicId });
        }

        // Update status to queued now that all data is ready
        await supabase.from('video_jobs').update({ status: 'queued' }).eq('id', job.id);

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
