import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";
import { Readable, PassThrough } from "stream";

export const maxDuration = 300;

async function getAuthenticatedClient(clientId: string, clientSecret: string, refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/youtube` : "http://localhost:3000/api/auth/callback/youtube"
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
}

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

    // Mark as uploading in DB
    await supabase.from("video_jobs").update({ youtube_status: "uploading" }).eq("id", id);

    try {
        // 2. Auth
        const auth = await getAuthenticatedClient(client_id, client_secret, refresh_token);
        const youtube = google.youtube({ version: "v3", auth });

        // 3. Get video size
        console.log(`[Publish] Fetching video HEAD: ${job.video_url.substring(0, 60)}...`);
        const headRes = await fetch(job.video_url, { method: "HEAD" });
        const contentLength = headRes.headers.get("content-length");
        const fileSize = contentLength ? parseInt(contentLength) : 0;
        console.log(`[Publish] Video size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

        // 4. Start download and stream directly to YouTube
        console.log("[Publish] Starting download + stream to YouTube...");
        const videoRes = await fetch(job.video_url);
        if (!videoRes.ok || !videoRes.body) throw new Error("Failed to download video");

        const passThrough = new PassThrough();
        // @ts-expect-error - Web ReadableStream to Node Readable
        const nodeStream = Readable.fromWeb(videoRes.body);

        // Track progress
        let bytesProcessed = 0;
        const startTime = Date.now();
        nodeStream.on("data", (chunk: Buffer) => {
            bytesProcessed += chunk.length;
            const pct = fileSize > 0 ? Math.round((bytesProcessed / fileSize) * 100) : 0;
            const elapsed = (Date.now() - startTime) / 1000;
            if (pct % 10 === 0 || elapsed > 250) {
                console.log(`[Publish] Progress: ${pct}% (${(bytesProcessed / 1024 / 1024).toFixed(0)}/${(fileSize / 1024 / 1024).toFixed(0)} MB) — ${elapsed.toFixed(0)}s`);
            }
        });
        nodeStream.pipe(passThrough);

        // 5. Upload to YouTube
        const title = inputTitle || job.title_text || `My Video`;
        const description = inputDesc || `Created with Makine Video AI`;
        const tags = Array.isArray(inputTags) ? inputTags : ["music", "video"];
        const privacyStatus = inputPrivacy || "private";

        const res = await youtube.videos.insert({
            part: ["snippet", "status"],
            requestBody: {
                snippet: { title: title.substring(0, 100), description, tags, categoryId: "22" },
                status: { privacyStatus, selfDeclaredMadeForKids: false, publishAt: publishAt || undefined },
            },
            media: { body: passThrough },
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`[Publish] ✅ Complete in ${elapsed}s! YouTube ID: ${res.data.id}`);

        // 6. Update DB with success status
        const ytStatus = publishAt ? 'scheduled' : 'published';
        const updateData: any = {
            youtube_status: ytStatus,
            youtube_id: res.data.id,
        };
        if (publishAt) {
            updateData.youtube_scheduled_at = publishAt;
        }

        const { error: dbError } = await supabase
            .from("video_jobs")
            .update(updateData)
            .eq("id", id);

        if (dbError) {
            console.error("[Publish] DB update error:", dbError);
        }

        return NextResponse.json({
            success: true,
            youtubeId: res.data.id,
            url: `https://youtu.be/${res.data.id}`,
            status: ytStatus,
        });

    } catch (error: any) {
        console.error("[Publish] ❌ Error:", error?.message || error);
        // Reset status on failure
        await supabase.from("video_jobs").update({ youtube_status: "none" }).eq("id", id);
        return NextResponse.json({ error: error?.message || "Upload failed" }, { status: 500 });
    }
}
