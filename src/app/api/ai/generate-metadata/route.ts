import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60; // Allow longer generation time

export async function POST(request: NextRequest) {
    // Initialize OpenAI client inside handler to avoid build-time errors if env var is missing
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const { image_url, channel_info, keywords } = await request.json();

        if (!image_url) {
            return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        const prompt = `
        You are a YouTube Growth Expert and SEO Specialist.
        
        Task: Generate metadata for a YouTube video based on the provided image, channel information, and keywords.
        
        Context:
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

    } catch (error) {
        console.error('AI Metadata Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate metadata' }, { status: 500 });
    }
}
