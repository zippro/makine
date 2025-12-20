
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";

// Helper to refresh token
async function getAuthenticatedClient(clientId: string, clientSecret: string, refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/youtube` : "http://localhost:3000/api/auth/callback/youtube"
    );

    oauth2Client.setCredentials({
        refresh_token: refreshToken
    });

    return oauth2Client;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;
    const supabase = await createClient();

    let body;
    try {
        body = await request.json();
    } catch {
        body = {};
    }

    const {
        title: inputTitle,
        description: inputDesc,
        tags: inputTags,
        privacyStatus: inputPrivacy,
        publishAt
    } = body;

    // 1. Get Job Details
    const { data: job, error: jobError } = await supabase
        .from("video_jobs")
        .select(`
            *,
            project:projects (
                id,
                youtube_creds
            )
        `)
        .eq("id", id)
        .single();

    if (jobError || !job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.video_url) {
        return NextResponse.json({ error: "Video not ready (no video_url)" }, { status: 400 });
    }

    // 2. Validate Credentials
    const project = job.project;
    if (!project || !project.youtube_creds || !project.youtube_creds.refresh_token) {
        return NextResponse.json({ error: "YouTube credentials missing in Project Settings" }, { status: 400 });
    }

    const { client_id, client_secret, refresh_token } = project.youtube_creds;

    try {
        // 3. Authenticate
        const auth = await getAuthenticatedClient(client_id, client_secret, refresh_token);
        const youtube = google.youtube({ version: "v3", auth });

        // 4. Download Video to Temp File (YouTube API needs a stream or file)
        // Since video_url is a Supabase Storage URL, we fetch it
        const videoResponse = await fetch(job.video_url);
        if (!videoResponse.ok) throw new Error("Failed to download video file");

        // Convert web stream to Node readable stream
        // @ts-expect-error - Web streams to Node streams mismatch
        const videoStream = Readable.fromWeb(videoResponse.body);

        // 5. Upload to YouTube
        // Use input metadata or fallbacks
        const title = inputTitle || job.title_text || `My Video ${new Date().toLocaleDateString()}`;
        const description = inputDesc || `Created with Music Video Creator for project: ${project.name || 'Unknown'}\n\n#shorts`;
        const tags = Array.isArray(inputTags) ? inputTags : ["music", "video", "creator"];

        const privacyStatus = inputPrivacy || "private";

        const res = await youtube.videos.insert({
            part: ["snippet", "status"],
            requestBody: {
                snippet: {
                    title: title.substring(0, 100), // Max 100 chars
                    description: description,
                    tags: tags,
                    categoryId: "22", // People & Blogs
                },
                status: {
                    privacyStatus: privacyStatus,
                    selfDeclaredMadeForKids: false,
                    publishAt: publishAt || undefined, // Only for scheduled uploads
                },
            },
            media: {
                body: videoStream,
            },
        });

        // 6. Update Job with YouTube ID
        console.log("Upload success:", res.data);

        return NextResponse.json({
            success: true,
            youtubeId: res.data.id,
            url: `https://youtu.be/${res.data.id}`
        });

    } catch (error) {
        console.error("YouTube Upload Error:", error);
        // @ts-expect-error - Error typing
        return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }
}
