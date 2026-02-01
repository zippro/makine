import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const projectId = searchParams.get("state"); // We passed projectId as state
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.json({ error: `Google Auth Error: ${error}` }, { status: 400 });
    }

    if (!code || !projectId) {
        return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Get the Client ID/Secret we saved earlier
    const { data: project } = await supabase
        .from("projects")
        .select("youtube_creds")
        .eq("id", projectId)
        .single();

    if (!project || !project.youtube_creds || !project.youtube_creds.client_id) {
        return NextResponse.json({ error: "Project credentials not found. Please restart flow." }, { status: 400 });
    }

    const { client_id, client_secret } = project.youtube_creds;

    // Force production URL in production to avoid env var mismatches
    const baseUrl = process.env.NODE_ENV === 'production'
        ? "https://makine-video-ai.vercel.app"
        : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

    const redirectUrl = `${baseUrl}/api/auth/callback/youtube`;

    const oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUrl
    );

    try {
        // 2. Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            // If the user has already authorized, Google won't return a refresh token again
            // unless we revoke access or force prompt. For MVP, we warn the user.
            // Ideally should force prompt in the auth url.
            return NextResponse.json({
                error: "No refresh token returned. You may have already authorized this app. " +
                    "Please revoke access in your Google Account permissions and try again."
            }, { status: 400 });
        }

        // 3. Save refresh token
        await supabase.from("projects").update({
            youtube_creds: {
                client_id,
                client_secret,
                refresh_token: tokens.refresh_token,
                connected_at: new Date().toISOString()
            }
        }).eq("id", projectId);

        // 4. Redirect back to project page
        // Assuming /projects or similar. Just redirect to root/projects for now.
        return NextResponse.redirect(new URL("/projects", request.url));

    } catch (err: any) {
        console.error("Token Exchange Error:", err);
        return NextResponse.json({ error: "Failed to exchange token", details: err.message }, { status: 500 });
    }
}
