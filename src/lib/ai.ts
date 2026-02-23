import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/server';

// ============================================================================
// AI Settings Type
// ============================================================================

export interface AISettings {
    id: string;
    vlm_provider: string;
    vlm_model: string;
    vlm_api_url: string;
    video_provider: string;
    video_model: string;
    video_api_url: string;
    video_status_url: string;
    default_duration: number;
    poll_interval_ms: number;
    max_poll_attempts: number;
    animation_system_prompt: string;
    animation_user_prompt: string;
}

// ============================================================================
// Default Configuration (fallback if database unavailable)
// ============================================================================

export const DEFAULT_AI_SETTINGS: Omit<AISettings, 'id'> = {
    vlm_provider: 'openai',
    vlm_model: process.env.VLM_MODEL || 'gpt-4o',
    vlm_api_url: 'https://api.openai.com/v1/chat/completions',
    video_provider: 'fal-kling',
    video_model: 'kling-video-o1',
    video_api_url: 'https://queue.fal.run/fal-ai/kling-video/o1/image-to-video',
    video_status_url: 'https://queue.fal.run/fal-ai/kling-video/requests',
    default_duration: parseInt(process.env.VIDEO_DURATION || '10', 10),
    poll_interval_ms: 15000,
    max_poll_attempts: 40,
    animation_system_prompt: `You are an expert at analyzing images and writing prompts for AI video generation (Kling AI). You create concise, vivid animation prompts that describe realistic motion for the subject in the image.

Rules:
- Write a single, detailed prompt suitable for image-to-video generation.
- Focus on the actual content of the image — describe what you see and how it should move.
- If the user provides specific instructions, follow them closely.
- Keep the prompt under 500 characters.
- Be specific about motion: what moves, how it moves, the speed and direction.
- Include lighting and atmosphere details when relevant.
- Do NOT add unrelated content that isn't in the image.`,
    animation_user_prompt: `Look at this image and write a prompt for Kling AI to animate it.

{user_prompt}

Requirements:
- Describe realistic, natural motion for the subject in the image.
- Keep a static camera unless the user says otherwise.
- Output a single prompt string suitable for image-to-video generation.
- Be concise but vivid.`,
};

// ============================================================================
// Settings Cache (to avoid repeated DB calls)
// ============================================================================

let cachedSettings: AISettings | null = null;
let cacheTime: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get AI settings from database (with caching)
 */
export async function getAISettings(): Promise<AISettings> {
    // Return cached settings if still valid
    if (cachedSettings && Date.now() - cacheTime < CACHE_TTL_MS) {
        return cachedSettings;
    }

    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('ai_settings')
            .select('*')
            .limit(1)
            .single();

        if (error || !data) {
            console.warn('Failed to fetch AI settings, using defaults:', error?.message);
            return { id: 'default', ...DEFAULT_AI_SETTINGS };
        }

        cachedSettings = data as AISettings;
        cacheTime = Date.now();
        return cachedSettings;
    } catch (error) {
        console.warn('Error fetching AI settings, using defaults:', error);
        return { id: 'default', ...DEFAULT_AI_SETTINGS };
    }
}

/**
 * Clear the settings cache (call after updating settings)
 */
export function clearSettingsCache(): void {
    cachedSettings = null;
    cacheTime = 0;
}

// ============================================================================
// OpenAI Client (lazy initialization)
// ============================================================================

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

// ============================================================================
// Prompt Generation (VLM)
// ============================================================================

export interface GeneratePromptOptions {
    imageUrl: string;
    userPrompt?: string;
    systemPrompt?: string;
    userPromptTemplate?: string;
}

export interface GeneratePromptResult {
    prompt: string;
    model: string;
}

/**
 * Generate an animation prompt using OpenAI's VLM (Vision Language Model)
 */
export async function generateAnimationPrompt(
    options: GeneratePromptOptions
): Promise<GeneratePromptResult> {
    const settings = await getAISettings();
    const openai = getOpenAIClient();
    const { imageUrl, userPrompt = '', systemPrompt, userPromptTemplate } = options;

    // Use provided prompts or fall back to settings from database
    const systemMessage = systemPrompt || settings.animation_system_prompt;
    const userTemplate = userPromptTemplate || settings.animation_user_prompt;

    // Build the user message content
    const textPrompt = userTemplate
        .replace('{user_prompt}', userPrompt)
        .replace('{{user_prompt}}', userPrompt); // Support both formats

    console.log(`[AI] Using VLM model: ${settings.vlm_model}`);

    const response = await openai.chat.completions.create({
        model: settings.vlm_model,
        messages: [
            {
                role: 'system',
                content: systemMessage,
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: textPrompt },
                    { type: 'image_url', image_url: { url: imageUrl } },
                ],
            },
        ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('No content generated from VLM');
    }

    return {
        prompt: content.replace(/"/g, ''), // Clean up any quotes
        model: settings.vlm_model,
    };
}

// ============================================================================
// Fal.ai Video Generation
// ============================================================================

export interface SubmitVideoOptions {
    prompt: string;
    imageUrl: string;
    duration?: number;
}

export interface SubmitVideoResult {
    requestId: string;
    statusUrl: string;
}

/**
 * Submit a video generation request to Fal.ai Kling API
 */
export async function submitVideoGeneration(
    options: SubmitVideoOptions
): Promise<SubmitVideoResult> {
    const settings = await getAISettings();
    const { prompt, imageUrl, duration } = options;
    const videoDuration = duration || settings.default_duration;

    const falApiKey = process.env.FAL_AI_KEY;
    if (!falApiKey) {
        throw new Error('FAL_AI_KEY environment variable is not set');
    }

    console.log(`[AI] Using video API: ${settings.video_api_url}`);

    const response = await fetch(settings.video_api_url, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${falApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt,
            start_image_url: imageUrl,
            end_image_url: imageUrl, // Same image for loop
            duration: String(videoDuration),
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Fal.ai submission failed: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
        requestId: data.request_id,
        statusUrl: data.status_url || `${settings.video_status_url}/${data.request_id}`,
    };
}

// ============================================================================
// Fal.ai Status Polling
// ============================================================================

export interface VideoStatusResult {
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    videoUrl?: string;
    error?: string;
}

/**
 * Check the status of a Fal.ai video generation request
 */
export async function getVideoStatus(requestId: string): Promise<VideoStatusResult> {
    const settings = await getAISettings();

    const falApiKey = process.env.FAL_AI_KEY;
    if (!falApiKey) {
        throw new Error('FAL_AI_KEY environment variable is not set');
    }

    // Use the /status endpoint to check progress (not the result endpoint)
    const statusUrl = `${settings.video_status_url}/${requestId}/status`;
    console.log(`[AI] Checking status at: ${statusUrl}`);

    const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Key ${falApiKey}`,
        },
    });

    // Handle 400 "Request is still in progress" gracefully
    if (!response.ok) {
        const errorText = await response.text();

        // Fal.ai returns 400 when request is still being processed
        if (response.status === 400 && errorText.includes('still in progress')) {
            console.log(`[AI] Request ${requestId} still in progress (400 response)`);
            return { status: 'IN_PROGRESS' };
        }

        throw new Error(`Fal.ai status check failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Map Fal.ai response to our interface
    if (data.status === 'COMPLETED') {
        // When completed, fetch the actual result from the response URL
        const resultUrl = `${settings.video_status_url}/${requestId}`;
        console.log(`[AI] Fetching result from: ${resultUrl}`);

        const resultResponse = await fetch(resultUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Key ${falApiKey}`,
            },
        });

        if (resultResponse.ok) {
            const resultData = await resultResponse.json();
            return {
                status: 'COMPLETED',
                videoUrl: resultData.video?.url || resultData.output?.video?.url || data.video?.url,
            };
        }

        return {
            status: 'COMPLETED',
            videoUrl: data.video?.url || data.output?.video?.url,
        };
    } else if (data.status === 'FAILED' || data.status === 'error') {
        return {
            status: 'FAILED',
            error: data.error || 'Video generation failed',
        };
    } else {
        return {
            status: data.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'IN_QUEUE',
        };
    }
}

/**
 * Poll Fal.ai until video is ready or fails
 */
export async function pollVideoUntilComplete(
    requestId: string,
    onProgress?: (status: string, attempt: number) => void
): Promise<VideoStatusResult> {
    const settings = await getAISettings();
    let attempts = 0;

    while (attempts < settings.max_poll_attempts) {
        attempts++;

        const status = await getVideoStatus(requestId);

        if (onProgress) {
            onProgress(status.status, attempts);
        }

        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            return status;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, settings.poll_interval_ms));
    }

    return {
        status: 'FAILED',
        error: 'Polling timeout - max attempts reached',
    };
}
