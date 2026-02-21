// fal.ai service layer — Direct REST calls to Flux 2 Turbo
// Uses the same auth pattern as ai.ts (FAL_AI_KEY + Key header)

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TextToImageRequest {
    prompt: string;
    image_size?: string;
    num_images?: number;
    seed?: number;
    guidance_scale?: number;
    enable_safety_checker?: boolean;
}

export interface ImageVariationRequest {
    imageUrl: string;
    prompt: string; // required for edit endpoint
    num_images?: number;
    seed?: number;
    image_size?: string;
    guidance_scale?: number;
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

// ─── API Base (same as ai.ts uses for video) ─────────────────────────────────

const FAL_API_BASE = "https://queue.fal.run";

function getApiKey(): string {
    const key = process.env.FAL_AI_KEY;
    if (!key) throw new Error("FAL_AI_KEY environment variable is not set");
    return key;
}

async function falRequest(model: string, input: Record<string, any>): Promise<any> {
    const key = getApiKey();

    // Submit to queue
    console.log(`[fal.ai] Submitting to ${model}...`);
    const submitRes = await fetch(`${FAL_API_BASE}/${model}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Key ${key}`,
        },
        body: JSON.stringify(input),
    });

    if (!submitRes.ok) {
        const errText = await submitRes.text();
        console.error(`[fal.ai] Submit failed (${submitRes.status}):`, errText);
        throw new Error(`fal.ai error (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json();

    // If we got a direct result (synchronous), return it
    if (submitData.images) {
        console.log(`[fal.ai] Got synchronous result with ${submitData.images.length} images`);
        return submitData;
    }

    // Otherwise poll the queue
    const requestId = submitData.request_id;
    const statusUrl = `${FAL_API_BASE}/${model}/requests/${requestId}/status`;
    const resultUrl = `${FAL_API_BASE}/${model}/requests/${requestId}`;

    console.log(`[fal.ai] Queued: ${requestId}, polling...`);

    // Poll for completion (max 120 seconds)
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));

        const statusRes = await fetch(statusUrl, {
            headers: { "Authorization": `Key ${key}` },
        });

        if (!statusRes.ok) continue;
        const status = await statusRes.json();

        console.log(`[fal.ai] Poll ${i + 1}: status=${status.status}`);

        if (status.status === "COMPLETED") {
            const resultRes = await fetch(resultUrl, {
                headers: { "Authorization": `Key ${key}` },
            });
            if (!resultRes.ok) throw new Error("Failed to fetch result");
            return await resultRes.json();
        }

        if (status.status === "FAILED") {
            throw new Error(`Generation failed: ${status.error || "Unknown error"}`);
        }
    }

    throw new Error("Generation timed out after 120 seconds");
}

// ─── Retry Wrapper ───────────────────────────────────────────────────────────

const MAX_RETRIES = 2;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            console.error(`[fal.ai] Attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
            if (attempt === MAX_RETRIES) throw err;
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
    throw new Error("Unreachable");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate images from text prompt using Flux 2 Turbo
 * Endpoint: fal-ai/flux-2/turbo
 */
export async function generateTextToImage(req: TextToImageRequest): Promise<FalResult> {
    return withRetry(() => falRequest("fal-ai/flux-2/turbo", {
        prompt: req.prompt,
        image_size: req.image_size || "landscape_4_3",
        num_images: req.num_images || 1,
        guidance_scale: req.guidance_scale || 2.5,
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
        enable_safety_checker: req.enable_safety_checker ?? true,
        output_format: "png",
    }));
}

/**
 * Generate image variations (edit) using Flux 2 Turbo
 * Endpoint: fal-ai/flux-2/turbo/edit
 * The edit endpoint takes image_urls (array) and a prompt
 */
export async function generateImageVariation(req: ImageVariationRequest): Promise<FalResult> {
    return withRetry(() => falRequest("fal-ai/flux-2/turbo/edit", {
        prompt: req.prompt,
        image_urls: [req.imageUrl],
        image_size: req.image_size || "landscape_4_3",
        num_images: req.num_images || 1,
        guidance_scale: req.guidance_scale || 2.5,
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
        enable_safety_checker: true,
        output_format: "png",
    }));
}
