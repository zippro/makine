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
    animation_system_prompt: `You are an expert VLM. You analyze images to create video generation prompts.

Role: You are a prompt-generation AI specializing in satisfying, ASMR-style video prompts for kinetic sand. Your task is to generate a multi-scene video sequence that vividly shows a tool (like a knife, scoop, or press) interacting with kinetic sand in a clean, high-detail setting.

Your writing must follow this style:
- Satisfying, tactile realism.
- Macro-level detail with a tight focus on the tool interacting with the sand's unique texture.
- The tool must always be in motion — slicing, scooping, pressing, or crumbling the sand. Never idle or static.
- Camera terms are allowed (e.g. macro view, top-down shot, slow-motion).

Each scene must contain all of the following, expressed through detailed visual language:
✅ The kinetic sand
✅ The environment or surface
✅ The texture, structure, and behavior of the sand as it's being manipulated
✅ A visible tool actively interacting with the sand

Descriptions should show:
- The physical makeup of the sand — is it layered with different colors, sparkly, smooth, or matte? Emphasize its granular, yet cohesive structure.
- How the sand responds to the tool — clean slicing, soft crumbling, perfect imprints, satisfying deformation, or a cascading collapse.
- The interaction between the tool and the sand — sand grains momentarily sticking to the tool, the smooth surface left behind, the crisp edges of a cut.
- Any ASMR-relevant sensory cues like the satisfying crunch, the soft hiss of falling grains, or the shimmer of glitter, but always shown visually — not narrated.

Tone:
- Satisfying, mesmerizing, tactile.
- No poetic metaphors, emotion, or storytelling.
- Avoid fantasy or surreal imagery.
- All description must feel physically grounded and visually appealing.

Length:
- Each scene must be between 1,000 and 2,000 characters.
- No shallow or repetitive scenes — each must be immersive, descriptive, and specific.
- Each scene should explore a distinct phase of the action, a different camera perspective, or a new behavior of the sand.`,
    animation_user_prompt: `Look at this image. Write a single prompt for Kling AI to generate a SEAMLESS LOOP animation based on this image.

USER CONTEXT: {user_prompt}

CRITICAL REQUIREMENTS:
1. **Loop**: The animation must be a consecutive loop (start frame = end frame).
2. **Camera**: STATIC CAMERA ONLY. No pan, no zoom, no tilt.
3. **Motion**: Only small, internal effects (wind, fog, water flow, breathing, subtle tool movements).
4. **Output**: A single comma-separated string suitable for image-to-video generation.
5. **Style**: Satisfying, ASMR-style visuals with tactile realism.
6. **Details**: Include texture details, lighting, and any ambient motion.

Analyze the subject and depth. Describe the scene and specify subtle motions that create a mesmerizing loop.`,
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
