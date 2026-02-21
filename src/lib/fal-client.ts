import * as fal from "@fal-ai/serverless-client";

// Configure fal.ai with server-side API key
fal.config({
    credentials: process.env.FAL_AI_KEY!,
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TextToImageRequest {
    prompt: string;
    image_size?: string; // e.g "landscape_16_9", "square", "portrait_4_3"
    num_images?: number; // 1-4
    seed?: number;
    enable_safety_checker?: boolean;
}

export interface ImageVariationRequest {
    imageUrl: string;
    prompt?: string;
    num_images?: number; // 1-4
    strength?: number; // 0.0 - 1.0
    seed?: number;
    image_size?: string;
}

export interface FalImage {
    url: string;
    width: number;
    height: number;
    content_type: string;
}

export interface FalResult {
    images: FalImage[];
    seed: number;
    prompt: string;
}

// ─── Size Presets ────────────────────────────────────────────────────────────

export const IMAGE_SIZE_PRESETS: Record<string, { label: string; value: string }> = {
    "square": { label: "Square (1:1)", value: "square" },
    "square_hd": { label: "Square HD (1:1)", value: "square_hd" },
    "landscape_4_3": { label: "Landscape (4:3)", value: "landscape_4_3" },
    "landscape_16_9": { label: "Landscape (16:9)", value: "landscape_16_9" },
    "portrait_4_3": { label: "Portrait (3:4)", value: "portrait_4_3" },
    "portrait_16_9": { label: "Portrait (9:16)", value: "portrait_16_9" },
};

// ─── API Functions ───────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            console.error(`[fal.ai] Attempt ${attempt}/${retries} failed:`, err.message);
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
        }
    }
    throw new Error("Unreachable");
}

/**
 * Generate images from text prompt using Flux2 Fast
 */
export async function generateTextToImage(req: TextToImageRequest): Promise<FalResult> {
    return withRetry(async () => {
        const result = await fal.subscribe("fal-ai/flux/schnell", {
            input: {
                prompt: req.prompt,
                image_size: req.image_size || "landscape_16_9",
                num_images: req.num_images || 1,
                ...(req.seed !== undefined ? { seed: req.seed } : {}),
                enable_safety_checker: req.enable_safety_checker ?? true,
            },
            logs: true,
        });

        return result as unknown as FalResult;
    });
}

/**
 * Generate variations of an existing image using Flux2 Fast (img2img)
 */
export async function generateImageVariation(req: ImageVariationRequest): Promise<FalResult> {
    return withRetry(async () => {
        const result = await fal.subscribe("fal-ai/flux/schnell/redux", {
            input: {
                image_url: req.imageUrl,
                ...(req.prompt ? { prompt: req.prompt } : {}),
                image_size: req.image_size || "landscape_16_9",
                num_images: req.num_images || 1,
                ...(req.seed !== undefined ? { seed: req.seed } : {}),
            },
            logs: true,
        });

        return result as unknown as FalResult;
    });
}
