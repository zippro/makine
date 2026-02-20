import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

// Shared prompt builder — used by both local OpenAI and N8n paths
function buildMetadataPrompt(videoTitle: string, channelInfo: string, keywords: string): string {
    return `You are a real YouTube creator writing metadata for your own video. Write like a human, not a marketing bot.

Video name: ${videoTitle || 'Music Video'}
Channel: ${channelInfo || 'Music Channel'}
Topics/keywords to work in naturally: ${keywords || 'music, video, visualizer'}

Write a JSON object with title, description, and tags for this YouTube video.

RULES — follow these strictly:
- Title (max 80 chars): Make it catchy but real. Write like you'd actually name your own video. Don't use all-caps words. Don't start with "Discover" or "Unleash" or any AI-sounding word. Keep it simple and interesting.
- Description (3-5 lines max): Write casually, like you're telling a friend about the video. First line should hook attention. Work in 2-3 of the keywords but don't force them. End with 2-3 hashtags. Do NOT write in bullet points. Do NOT use phrases like "immerse yourself", "dive into", "embark on a journey", "experience the magic" — these scream AI.
- Tags (comma-separated string, 8-12 tags): Mix of broad terms and specific ones people would actually search. No generic spam.

NEVER include the words "AI", "generated", "created by AI", or anything similar in the title, description, or tags.
Keep the overall vibe natural. Vary your sentence lengths. It's okay to be a bit casual or use short sentences.

Output ONLY valid JSON:
{ "title": "string", "description": "string", "tags": "string" }`;
}

export async function POST(request: NextRequest) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const { image_url, channel_info, keywords, video_title } = await request.json();

        const prompt = buildMetadataPrompt(video_title, channel_info, keywords);

        // Feature Flag: Dedicated N8n Metadata Webhook (separate from video creation webhook)
        const n8nWebhookUrl = process.env.N8N_METADATA_WEBHOOK_URL;

        if (n8nWebhookUrl) {
            console.log("Delegating generation to N8n:", n8nWebhookUrl);
            const n8nResponse = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url,
                    channel_info,
                    keywords,
                    video_title,
                    prompt
                })
            });

            if (!n8nResponse.ok) {
                throw new Error(`N8n Webhook failed: ${n8nResponse.statusText}`);
            }

            const data = await n8nResponse.json();
            return NextResponse.json(data);
        }

        // Local OpenAI Call — using gpt-4o-mini (fast, cheap, no vision needed)
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You output valid JSON only. No extra text."
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.9, // Higher temp = more varied, less robotic output
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
