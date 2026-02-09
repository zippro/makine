import { NextRequest, NextResponse } from 'next/server';
import { generateAnimationPrompt } from '@/lib/ai';

export const maxDuration = 60;

// POST /api/animations/generate-prompt - Generate a prompt for an image without creating animation
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { image_url, user_prompt, animation_prompt } = body;

        if (!image_url) {
            return NextResponse.json(
                { error: 'Missing required field: image_url' },
                { status: 400 }
            );
        }

        const result = await generateAnimationPrompt({
            imageUrl: image_url,
            userPrompt: user_prompt || '',
            userPromptTemplate: animation_prompt,
        });

        return NextResponse.json({
            prompt: result.prompt,
            model: result.model,
        });
    } catch (error) {
        console.error('[Generate Prompt] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate prompt' },
            { status: 500 }
        );
    }
}
