
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
    const supabase = createClient();

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
    // @ts-expect-error - Supabase join types are tricky
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
        // Construct metadata (Title, Description)
        // For now, simple title. Ideally we generate this via AI or user input
        const title = job.title_text || `My Video ${new Date().toLocaleDateString()}`;
        const description = `Created with Music Video Creator for project: ${project.name || 'Unknown'}\n\n#shorts`;

        const res = await youtube.videos.insert({
            part: ["snippet", "status"],
            requestBody: {
                snippet: {
                    title: title.substring(0, 100), // Max 100 chars
                    description: description,
                    tags: ["music", "video", "creator"],
                    categoryId: "22", // People & Blogs
                },
                status: {
                    privacyStatus: "private", // Default to private for safety
                    selfDeclaredMadeForKids: false,
                },
            },
            media: {
                body: videoStream,
            },
        });

        // 6. Update Job with YouTube ID
        // We'll store it in a new column or just 'metadata' if we had one. 
        // For now, let's just return success. 
        // OR we can misuse 'error_message' to store the link temporarily if we don't have a column?
        // Let's rely on the user adding a 'youtube_id' column later or putting it in assets/metadata.
        // Given we just added 'assets', let's try to put it there if we can update it safely.

        // Actually, let's just log it and return it.
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
