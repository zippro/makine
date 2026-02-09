import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
    generateAnimationPrompt,
    submitVideoGeneration,
    pollVideoUntilComplete,
    getAISettings,
} from '@/lib/ai';

export const maxDuration = 300; // Allow up to 5 minutes for video generation

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

        // Step 1: Generate animation prompt using VLM
        const settings = await getAISettings();
        console.log(`[Animation Generate] Generating prompt with ${settings.vlm_model}...`);

        let generatedPrompt: string;
        try {
            const promptResult = await generateAnimationPrompt({
                imageUrl: image_url,
                userPrompt: prompt || '',
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
                // Retry once
                const retryResult = await generateAnimationPrompt({
                    imageUrl: image_url,
                    userPrompt: prompt || '',
                    userPromptTemplate: animation_prompt,
                });
                const retryPrompt = retryResult.prompt;
                const retryLower = retryPrompt.toLowerCase();
                const isStillRefusal = refusalPhrases.some(phrase => retryLower.includes(phrase));

                if (isStillRefusal) {
                    // If user provided a prompt, use it directly as fallback
                    if (prompt && prompt.trim().length > 0) {
                        console.warn('[Animation Generate] VLM refusal persists, using user prompt as fallback');
                        generatedPrompt = prompt;
                    } else {
                        throw new Error('VLM could not analyze the image after 2 attempts. The image URL may not be accessible to OpenAI.');
                    }
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

        // Step 3: Poll for completion (this runs in the background of the request)
        // Note: This will block the response until complete, which is fine for Vercel with maxDuration
        console.log('[Animation Generate] Polling for completion...');

        try {
            const result = await pollVideoUntilComplete(requestId, (status, attempt) => {
                console.log(`[Animation Generate] Poll ${attempt}: ${status}`);
            });

            if (result.status === 'COMPLETED' && result.videoUrl) {
                console.log(`[Animation Generate] Success! Video URL: ${result.videoUrl}`);

                await supabase
                    .from('animations')
                    .update({
                        status: 'done',
                        url: result.videoUrl,
                        prompt: generatedPrompt,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', animation_id);

                return NextResponse.json({
                    success: true,
                    animation_id,
                    video_url: result.videoUrl,
                    prompt: generatedPrompt,
                });
            } else {
                console.error('[Animation Generate] Video generation failed:', result.error);

                await supabase
                    .from('animations')
                    .update({
                        status: 'error',
                        error_message: result.error || 'Video generation failed',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', animation_id);

                return NextResponse.json(
                    { error: result.error || 'Video generation failed' },
                    { status: 500 }
                );
            }
        } catch (pollError) {
            console.error('[Animation Generate] Polling failed:', pollError);

            await supabase
                .from('animations')
                .update({
                    status: 'error',
                    error_message: `Polling failed: ${pollError instanceof Error ? pollError.message : 'Unknown error'}`,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', animation_id);

            return NextResponse.json(
                { error: 'Failed to poll video status' },
                { status: 500 }
            );
        }

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
