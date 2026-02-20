import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const { channel_info, keywords, video_title } = await request.json();

        const channelName = channel_info || 'Music Channel';
        const videoName = video_title || 'Music Video';
        const targetKeywords = keywords || 'music, video, visualizer';

        const prompt = `You are a YouTube SEO expert who writes like a real creator — not a robot, not a marketer.

Your job: write metadata for this YouTube video that RANKS HIGH in search and gets clicks, but reads like a real person wrote it.

VIDEO: ${videoName}
CHANNEL: ${channelName}
TARGET KEYWORDS: ${targetKeywords}

Return a JSON object with "title", "description", and "tags".

=== TITLE (max 80 chars) ===
- Put the strongest keyword near the FRONT of the title
- Use a power word that triggers curiosity or emotion (e.g. "insane", "perfect", "hits different", "pure", "ultimate")
- Make it feel like something a real creator would name — NOT generic, NOT clickbait
- Don't use ALL CAPS words. Don't start with "Discover", "Unleash", "Experience"
- Think about what someone would actually TYPE into YouTube search and match that

=== DESCRIPTION (5-8 lines) ===
- First line = strong hook that makes people want to watch. This line appears in search results so make it count
- Second line = what the video is about, naturally including 2-3 keywords from the target list
- Add a short personal touch like "hope you enjoy this one" or "let me know your favorites" — keep it real
- Include the channel name once naturally
- End with 3 relevant hashtags that people actually search for
- Do NOT use bullet points, numbered lists, or marketing language
- BANNED phrases: "immerse yourself", "dive into", "embark on a journey", "experience the magic", "take you on a ride", "sit back and relax"

=== TAGS (comma-separated string, 10-15 tags) ===
- First 3 tags = exact match keywords people search on YouTube (most important for ranking)
- Next 5 tags = related long-tail search terms (e.g. "lofi beats to study to", "jazz music for relaxing")  
- Last tags = broader category terms
- Include trending variations people actually search for
- Mix English terms even if channel is in another language — YouTube search is global

CRITICAL: Never include "AI", "generated", "artificial" or anything similar anywhere. The output must read 100% human-written.

Output ONLY valid JSON:
{ "title": "string", "description": "string", "tags": "string" }`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You output valid JSON only. No markdown, no explanation, no extra text."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.85,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content generated");

        const metadata = JSON.parse(content);

        return NextResponse.json(metadata);

    } catch (error: any) {
        console.error('AI Metadata Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate metadata: ' + error.message }, { status: 500 });
    }
}

