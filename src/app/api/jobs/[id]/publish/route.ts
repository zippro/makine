import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Triggers YouTube upload on the Hetzner VPS.
 * The VPS reads the video from local disk and streams directly to YouTube.
 * This endpoint returns immediately — the upload happens in the background on the VPS.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;
    const supabase = await createClient();

    let body;
    try { body = await request.json(); } catch { body = {}; }

    const { title: inputTitle, description: inputDesc, tags: inputTags, privacyStatus: inputPrivacy, publishAt } = body;

    // 1. Get Job
    const { data: job, error: jobError } = await supabase
        .from("video_jobs")
        .select(`*, project:projects ( id, youtube_creds )`)
        .eq("id", id)
        .single();

    if (jobError || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.video_url) return NextResponse.json({ error: "Video not ready" }, { status: 400 });

    const project = job.project;
    if (!project?.youtube_creds?.refresh_token) {
        return NextResponse.json({ error: "YouTube credentials missing" }, { status: 400 });
    }

    const { client_id, client_secret, refresh_token } = project.youtube_creds;
    const serverIp = process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244';

    try {
        // 2. Send upload request to VPS
        console.log(`[Publish] Triggering VPS upload for job ${id}`);

        const vpsRes = await fetch(`http://${serverIp}:3002/youtube-upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobId: id,
                videoUrl: job.video_url,
                title: inputTitle || job.title_text || 'My Video',
                description: inputDesc || 'Created with Makine Video AI',
                tags: Array.isArray(inputTags) ? inputTags : ['music', 'video'],
                privacyStatus: inputPrivacy || 'private',
                publishAt: publishAt || undefined,
                clientId: client_id,
                clientSecret: client_secret,
                refreshToken: refresh_token,
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
                supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            }),
        });

        const vpsData = await vpsRes.json();

        if (!vpsRes.ok) {
            throw new Error(vpsData.error || `VPS error (${vpsRes.status})`);
        }

        console.log(`[Publish] VPS accepted upload for job ${id}`);

        return NextResponse.json({
            success: true,
            message: "Upload started on VPS",
            jobId: id,
        });

    } catch (error: any) {
        console.error("[Publish] ❌ Error triggering VPS:", error?.message);
        return NextResponse.json({ error: error?.message || "Failed to start upload" }, { status: 500 });
    }
}
