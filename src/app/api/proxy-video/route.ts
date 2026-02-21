import { NextRequest } from "next/server";

export const maxDuration = 300;

/**
 * CORS Proxy: Streams video from an external URL to the browser.
 * Used when the browser can't directly download from the video server
 * due to CORS restrictions (e.g. nginx without Access-Control-Allow-Origin).
 *
 * GET /api/proxy-video?url=https://46.62.209.244.nip.io/videos/xxx.mp4
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
        return new Response("Missing url parameter", { status: 400 });
    }

    // Security: only allow video URLs from known sources
    const allowed = [
        "46.62.209.244",
        "nip.io",
        "supabase.co",
        "supabase.in",
    ];
    const isAllowed = allowed.some(host => url.includes(host));
    if (!isAllowed) {
        return new Response("URL not allowed", { status: 403 });
    }

    try {
        console.log("Proxying video from:", url.substring(0, 80));
        const videoRes = await fetch(url);

        if (!videoRes.ok || !videoRes.body) {
            return new Response(`Upstream error: ${videoRes.status}`, { status: videoRes.status });
        }

        const contentLength = videoRes.headers.get("content-length");
        const contentType = videoRes.headers.get("content-type") || "video/mp4";

        console.log(`Proxying ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(1) + " MB" : "unknown size"}`);

        // Stream the response directly — no buffering
        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
        };
        if (contentLength) {
            headers["Content-Length"] = contentLength;
        }

        return new Response(videoRes.body, {
            status: 200,
            headers,
        });

    } catch (error: any) {
        console.error("Proxy error:", error.message);
        return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
}
