import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
    generateAnimationPrompt,
    submitVideoGeneration,
    getAISettings,
} from '@/lib/ai';

export const maxDuration = 60; // Only need time for prompt gen + submission, not polling

// POST /api/animations/generate - Generate animation from image using AI
export async function POST(request: NextRequest) {
    const supabase = createAdminClient();

    try {
        const body = await request.json();
        const { animation_id, image_url, duration, prompt, animation_prompt } = body;

        // Validate required fields
        if (!animation_id || !image_url) {
            return NextResponse.json(
                { error: 'Missing required fields: animation_id, image_url' },
                { status: 400 }
            );
        }

        console.log(`[Animation Generate] Starting for ${animation_id}`);

        // Update status to processing
        const { error: updateError } = await supabase
            .from('animations')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', animation_id);

        if (updateError) {
            console.error('[Animation Generate] Failed to update status:', updateError);
        }

        // Step 1: Determine animation prompt
        // If user typed a prompt, use it DIRECTLY (skip GPT-4o).
        // If no user prompt, use GPT-4o VLM to generate one from the image.
        const settings = await getAISettings();
        let generatedPrompt: string;

        if (prompt && prompt.trim().length > 0) {
            // User provided a custom prompt — use it directly for Kling
            generatedPrompt = prompt.trim();
            console.log(`[Animation Generate] Using user's prompt directly: ${generatedPrompt.substring(0, 100)}...`);
        } else {
            // No user prompt — generate one using GPT-4o VLM
            console.log(`[Animation Generate] No user prompt, generating with ${settings.vlm_model}...`);

            try {
                const promptResult = await generateAnimationPrompt({
                    imageUrl: image_url,
                    userPrompt: '',
                    userPromptTemplate: animation_prompt,
                });
                generatedPrompt = promptResult.prompt;
                console.log(`[Animation Generate] Generated prompt: ${generatedPrompt.substring(0, 100)}...`);

                // Validate VLM response - detect refusal/inability responses
                const refusalPhrases = [
                    "i'm unable to",
                    "i cannot",
                    "i can't",
                    "unable to analyze",
                    "i don't have the ability",
                    "i am unable",
                    "as an ai",
                    "i'm not able to",
                ];
                const lowerPrompt = generatedPrompt.toLowerCase();
                const isRefusal = refusalPhrases.some(phrase => lowerPrompt.includes(phrase));

                if (isRefusal) {
                    console.warn(`[Animation Generate] VLM returned a refusal response, retrying...`);
                    const retryResult = await generateAnimationPrompt({
                        imageUrl: image_url,
                        userPrompt: '',
                        userPromptTemplate: animation_prompt,
                    });
                    const retryPrompt = retryResult.prompt;
                    const retryLower = retryPrompt.toLowerCase();
                    const isStillRefusal = refusalPhrases.some(phrase => retryLower.includes(phrase));

                    if (isStillRefusal) {
                        throw new Error('VLM could not analyze the image after 2 attempts. The image URL may not be accessible to OpenAI.');
                    } else {
                        generatedPrompt = retryPrompt;
                    }
                }
            } catch (promptError) {
                console.error('[Animation Generate] Prompt generation failed:', promptError);
                await supabase
                    .from('animations')
                    .update({
                        status: 'error',
                        error_message: `Prompt generation failed: ${promptError instanceof Error ? promptError.message : 'Unknown error'}`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', animation_id);

                return NextResponse.json(
                    { error: 'Failed to generate animation prompt' },
                    { status: 500 }
                );
            }
        }

        // Save prompt to DB immediately (so it's not lost if later steps fail)
        await supabase
            .from('animations')
            .update({ prompt: generatedPrompt, updated_at: new Date().toISOString() })
            .eq('id', animation_id);

        // Step 2: Submit to Fal.ai for video generation
        console.log('[Animation Generate] Submitting to Fal.ai Kling...');

        let requestId: string;
        try {
            const submitResult = await submitVideoGeneration({
                prompt: generatedPrompt,
                imageUrl: image_url,
                duration: duration || settings.default_duration,
            });
            requestId = submitResult.requestId;
            console.log(`[Animation Generate] Submitted, request_id: ${requestId}`);
        } catch (submitError) {
            console.error('[Animation Generate] Fal.ai submission failed:', submitError);
            await supabase
                .from('animations')
                .update({
                    status: 'error',
                    error_message: `Video submission failed: ${submitError instanceof Error ? submitError.message : 'Unknown error'}`,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', animation_id);

            return NextResponse.json(
                { error: 'Failed to submit video generation' },
                { status: 500 }
            );
        }

        // Step 3: Store fal_request_id and return immediately (fire-and-forget)
        // The frontend will poll /api/animations/check to track progress
        await supabase
            .from('animations')
            .update({
                fal_request_id: requestId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', animation_id);

        console.log(`[Animation Generate] Stored request_id ${requestId}, returning immediately.`);

        return NextResponse.json({
            success: true,
            animation_id,
            request_id: requestId,
            prompt: generatedPrompt,
        });

    } catch (error) {
        console.error('Error in POST /api/animations/generate:', error);
        // Mark animation as error so it doesn't stay stuck at 'processing'
        try {
            const body = await request.clone().json().catch(() => null);
            if (body?.animation_id) {
                const supabase = createAdminClient();
                await supabase
                    .from('animations')
                    .update({
                        status: 'error',
                        error_message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', body.animation_id);
            }
        } catch (_) { /* best effort */ }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
