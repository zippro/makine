import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const supabase = await createClient();

    // Get project with YouTube creds
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

        // 1. Get channel info
        const channelRes = await youtube.channels.list({
            part: ["statistics", "snippet", "brandingSettings"],
            mine: true,
        });

        const channel = channelRes.data.items?.[0];
        if (!channel) {
            return NextResponse.json({ error: "Channel not found" }, { status: 404 });
        }

        // 2. Get all uploaded videos with stats
        const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
        let allVideoIds: string[] = [];

        // Get videos from channel
        const searchRes = await youtube.search.list({
            part: ["id"],
            forMine: true,
            type: ["video"],
            maxResults: 50,
            order: "date",
        });

        if (searchRes.data.items) {
            allVideoIds = searchRes.data.items
                .map(item => item.id?.videoId)
                .filter(Boolean) as string[];
        }

        // 3. Get detailed stats for each video
        let videos: any[] = [];
        if (allVideoIds.length > 0) {
            const videosRes = await youtube.videos.list({
                part: ["snippet", "statistics", "contentDetails"],
                id: allVideoIds,
            });

            videos = (videosRes.data.items || []).map(v => ({
                id: v.id,
                title: v.snippet?.title,
                description: v.snippet?.description?.substring(0, 200),
                thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
                publishedAt: v.snippet?.publishedAt,
                duration: v.contentDetails?.duration,
                viewCount: parseInt(v.statistics?.viewCount || "0"),
                likeCount: parseInt(v.statistics?.likeCount || "0"),
                commentCount: parseInt(v.statistics?.commentCount || "0"),
                favoriteCount: parseInt(v.statistics?.favoriteCount || "0"),
            }));
        }

        // Sort by views descending for top videos
        const topByViews = [...videos].sort((a, b) => b.viewCount - a.viewCount);
        const topByLikes = [...videos].sort((a, b) => b.likeCount - a.likeCount);

        // Calculate totals
        const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
        const totalLikes = videos.reduce((sum, v) => sum + v.likeCount, 0);
        const totalComments = videos.reduce((sum, v) => sum + v.commentCount, 0);

        // Recent videos (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentVideos = videos.filter(v => new Date(v.publishedAt) > thirtyDaysAgo);

        return NextResponse.json({
            channel: {
                title: channel.snippet?.title,
                description: channel.snippet?.description,
                thumbnail: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url,
                customUrl: channel.snippet?.customUrl,
                subscriberCount: parseInt(channel.statistics?.subscriberCount || "0"),
                totalViewCount: parseInt(channel.statistics?.viewCount || "0"),
                videoCount: parseInt(channel.statistics?.videoCount || "0"),
                hiddenSubscriberCount: channel.statistics?.hiddenSubscriberCount,
                createdAt: channel.snippet?.publishedAt,
            },
            stats: {
                totalViews,
                totalLikes,
                totalComments,
                videoCount: videos.length,
            },
            videos,
            topByViews: topByViews.slice(0, 10),
            topByLikes: topByLikes.slice(0, 10),
            recentVideos,
        });
    } catch (err: any) {
        console.error("[analytics] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
