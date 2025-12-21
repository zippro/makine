import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60; // Allow longer generation time

export async function POST(request: NextRequest) {
    // Initialize OpenAI client inside handler to avoid build-time errors if env var is missing
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const { image_url, channel_info, keywords, video_title } = await request.json();

        if (!image_url) {
            return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        // Feature Flag: N8n Webhook
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

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
                    prompt: `
                        You are a YouTube Growth Expert and SEO Specialist.
                        Task: Generate metadata for a YouTube video based on the provided image and context.
                        Context:
                        - Video Title/Topic: ${video_title || 'Unknown'}
                        - Channel Info: ${channel_info || 'General Music Channel'}
                        - Target Keywords: ${keywords || 'Music, Video, Visualizer'}
                        Requirements:
                        1. Title: Clickbait but relevant, high CTR, includes main keyword. (Max 60 chars preferred).
                        2. Description: SEO-optimized. First 2 lines are the "hook". Include keywords naturally. Add 3 hashtags.
                        3. Tags: 15-20 comma-separated high-volume tags mixed with long-tail tags.
                        Output Format (JSON only): { "title": "string", "description": "string", "tags": "string" }
                    `
                })
            });

            if (!n8nResponse.ok) {
                throw new Error(`N8n Webhook failed: ${n8nResponse.statusText}`);
            }

            // Expecting N8n to return the JSON directly or inside a structure we handle
            // Modify this based on actual N8n output structure if known. 
            // Assuming the workflow returns the OpenAI JSON content directly.
            const data = await n8nResponse.json();

            // Handle if N8n wraps it (common in N8n respond node)
            // If data is { title: ... } return it.
            // If data is [{ body: { ... } }] or similar, parse it.
            // For now, assume direct JSON object mapping or simple wrap.
            // Let's assume the N8n 'Respond to Webhook' mode 'json' returns the object.

            return NextResponse.json(data);
        }

        // FALLBACK: Local OpenAI Call
        const prompt = `
        You are a YouTube Growth Expert and SEO Specialist.
        
        Task: Generate metadata for a YouTube video based on the provided image and context.
        
        Context:
        - Video Title/Topic: ${video_title || 'Unknown'}
        - Channel Info: ${channel_info || 'General Music Channel'}
        - Target Keywords: ${keywords || 'Music, Video, Visualizer'}
        
        Requirements:
        1. Title: Clickbait but relevant, high CTR, includes main keyword. (Max 60 chars preferred, up to 100).
        2. Description: SEO-optimized. First 2 lines are the "hook". Include keywords naturally. Add 3 hashtags at the end.
        3. Tags: 15-20 comma-separated high-volume tags mixed with long-tail tags.
        
        Output Format (JSON only):
        {
            "title": "string",
            "description": "string",
            "tags": "string"
        }
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that outputs JSON."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                "url": image_url,
                            },
                        },
                    ],
                },
            ],
            response_format: { type: "json_object" },
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
