import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const clientId = searchParams.get("clientId");
    const clientSecret = searchParams.get("clientSecret");

    if (!projectId || !clientId || !clientSecret) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const supabase = await createClient();

    // Save temporary credentials to project so callback can use them to exchange token
    // (In a real app, use a session or encrypted cookie, but this is simpler for MVP)
    await supabase.from("projects").update({
        youtube_creds: { client_id: clientId, client_secret: clientSecret }
    }).eq("id", projectId);

    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/youtube`
        : "http://localhost:3000/api/auth/callback/youtube";

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUrl
    );

    const scopes = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly"
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: "offline", // Crucial for refresh_token
        scope: scopes,
        state: projectId // Pass projectId as state to know where to save token
    });

    return NextResponse.redirect(url);
}
