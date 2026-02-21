import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";

export const maxDuration = 30; // Only needs to create the upload session, not transfer data

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
 * Creates a YouTube resumable upload session and returns the upload URL.
 * The client (browser) then uploads the video directly to YouTube using this URL.
 * This bypasses Vercel's timeout/memory limits since data never flows through the server.
 */
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
        // 3. Get fresh access token
        const auth = await getAuthenticatedClient(client_id, client_secret, refresh_token);
        const { token } = await auth.getAccessToken();

        if (!token) {
            throw new Error("Failed to get YouTube access token. Re-connect YouTube in project settings.");
        }

        // 4. Create resumable upload session via YouTube API
        const title = inputTitle || job.title_text || `My Video ${new Date().toLocaleDateString()}`;
        const description = inputDesc || `Created with Makine Video AI\n\n#shorts`;
        const tags = Array.isArray(inputTags) ? inputTags : ["music", "video", "creator"];
        const privacyStatus = inputPrivacy || "private";

        const metadata = {
            snippet: {
                title: title.substring(0, 100),
                description,
                tags,
                categoryId: "22",
            },
            status: {
                privacyStatus,
                selfDeclaredMadeForKids: false,
                ...(publishAt ? { publishAt } : {}),
            },
        };

        // Initiate resumable upload session
        const initResponse = await fetch(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json; charset=UTF-8",
                    "X-Upload-Content-Type": "video/mp4",
                },
                body: JSON.stringify(metadata),
            }
        );

        if (!initResponse.ok) {
            const errText = await initResponse.text();
            console.error("YouTube upload init failed:", initResponse.status, errText);
            throw new Error(`YouTube rejected the upload: ${initResponse.status}`);
        }

        // The resumable upload URL is in the Location header
        const uploadUrl = initResponse.headers.get("location");
        if (!uploadUrl) {
            throw new Error("YouTube did not return an upload URL");
        }

        console.log(`Resumable upload session created for job ${id}`);

        return NextResponse.json({
            uploadUrl,
            videoUrl: job.video_url,
            accessToken: token,
        });

    } catch (error: any) {
        console.error("YouTube Upload Init Error:", error?.message || error);
        return NextResponse.json({ error: error?.message || "Failed to create upload session" }, { status: 500 });
    }
}
