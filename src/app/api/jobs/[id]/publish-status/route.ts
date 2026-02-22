import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies youtube upload status from VPS to client.
 * This avoids CORS/nginx issues — client polls Vercel, Vercel polls VPS.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;
    const serverIp = process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244';

    try {
        const res = await fetch(`http://${serverIp}:3002/youtube-status/${id}`, {
            signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ status: 'unknown' });
    }
}
