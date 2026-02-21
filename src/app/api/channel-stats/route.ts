import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const supabase = await createClient();

    const { data: project, error } = await supabase
        .from("projects")
        .select("youtube_creds")
        .eq("id", projectId)
        .single();

    if (error || !project?.youtube_creds?.refresh_token) {
        return NextResponse.json({ error: "No YouTube credentials" }, { status: 400 });
    }

    const { client_id, client_secret, refresh_token } = project.youtube_creds;

    try {
        const oauth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            process.env.NEXT_PUBLIC_APP_URL
                ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/youtube`
                : "http://localhost:3000/api/auth/callback/youtube"
        );
        oauth2Client.setCredentials({ refresh_token });

        const youtube = google.youtube({ version: "v3", auth: oauth2Client });

        // Get channel stats
        const channelRes = await youtube.channels.list({
            part: ["statistics", "snippet"],
            mine: true,
        });

        const channel = channelRes.data.items?.[0];
        if (!channel) {
            return NextResponse.json({ error: "Channel not found" }, { status: 404 });
        }

        return NextResponse.json({
            channelTitle: channel.snippet?.title,
            channelThumbnail: channel.snippet?.thumbnails?.default?.url,
            subscriberCount: channel.statistics?.subscriberCount,
            videoCount: channel.statistics?.videoCount,
            viewCount: channel.statistics?.viewCount,
        });
    } catch (err: any) {
        console.error("[channel-stats] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
