import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";

export const maxDuration = 30;

async function getAuthenticatedClient(clientId: string, clientSecret: string, refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/youtube` : "http://localhost:3000/api/auth/callback/youtube"
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
}

/**
 * Returns YouTube access token + video info so the browser can
 * create the upload session directly (enabling CORS on the upload URI).
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;
    const supabase = await createClient();

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
        return NextResponse.json({ error: "YouTube credentials missing in Project Settings" }, { status: 400 });
    }

    const { client_id, client_secret, refresh_token } = project.youtube_creds;

    try {
        // 2. Get fresh access token
        const auth = await getAuthenticatedClient(client_id, client_secret, refresh_token);
        const { token } = await auth.getAccessToken();
        if (!token) throw new Error("Failed to get YouTube access token. Re-connect YouTube.");

        // 3. Get video file size
        const headRes = await fetch(job.video_url, { method: "HEAD" });
        const contentLength = headRes.headers.get("content-length");
        const fileSize = contentLength ? parseInt(contentLength) : 0;

        console.log(`[publish-init] Job ${id}: token OK, fileSize ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

        return NextResponse.json({
            accessToken: token,
            videoUrl: job.video_url,
            fileSize,
        });

    } catch (error: any) {
        console.error("[publish-init] Error:", error?.message);
        return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
    }
}
