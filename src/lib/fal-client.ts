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

/**
 * Submit a request to fal.ai queue — returns request_id + URLs for polling
 */
export async function submitToFal(model: string, input: Record<string, any>): Promise<{ requestId: string; statusUrl: string; responseUrl: string }> {
    const key = getApiKey();

    console.log(`[fal.ai] Submitting to ${model}...`);
    const res = await fetch(`${FAL_API_BASE}/${model}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Key ${key}`,
        },
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`[fal.ai] Submit failed (${res.status}):`, errText);
        throw new Error(`fal.ai error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    console.log(`[fal.ai] Submit response keys:`, Object.keys(data));

    // If synchronous result, no need to poll
    if (data.images) {
        console.log(`[fal.ai] Got sync result with ${data.images.length} images`);
        return { requestId: "__SYNC__", statusUrl: "", responseUrl: "" };
    }

    const requestId = data.request_id;
    const statusUrl = data.status_url || `${FAL_API_BASE}/${model}/requests/${requestId}/status`;
    const responseUrl = data.response_url || `${FAL_API_BASE}/${model}/requests/${requestId}`;

    console.log(`[fal.ai] Queued: ${requestId}`);
    console.log(`[fal.ai] status_url: ${statusUrl}`);
    console.log(`[fal.ai] response_url: ${responseUrl}`);

    return { requestId, statusUrl, responseUrl };
}

/**
 * Check the status of a fal.ai request using direct URL
 */
export async function getFalRequestStatus(statusUrl: string): Promise<{ status: string; error?: string }> {
    const key = getApiKey();

    const res = await fetch(statusUrl, {
        headers: { "Authorization": `Key ${key}` },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`[fal.ai] Status check failed (${res.status}):`, text);
        if (res.status === 400 && text.includes("still in progress")) {
            return { status: "IN_PROGRESS" };
        }
        return { status: "FAILED", error: `${res.status}: ${text}` };
    }

    const data = await res.json();
    console.log(`[fal.ai] Status:`, data.status);
    return data;
}

/**
 * Get the completed result of a fal.ai request using direct URL
 */
export async function getFalRequestResult(responseUrl: string): Promise<FalResult> {
    const key = getApiKey();

    const res = await fetch(responseUrl, {
        headers: { "Authorization": `Key ${key}` },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch result: ${res.status}`);
    }

    return await res.json();
}

/**
 * Submit + wait for result (with internal polling, max ~55 seconds for Vercel)
 */
async function falRequestWithPolling(model: string, input: Record<string, any>): Promise<FalResult> {
    const key = getApiKey();

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

    // Synchronous result
    if (submitData.images) {
        console.log(`[fal.ai] Got sync result`);
        return submitData;
    }

    // Poll — max 50 seconds (stay under Vercel's 60s limit)
    const requestId = submitData.request_id;
    console.log(`[fal.ai] Queued: ${requestId}, polling (max 50s)...`);

    const startTime = Date.now();
    const MAX_WAIT = 50000; // 50 seconds

    while (Date.now() - startTime < MAX_WAIT) {
        await new Promise(r => setTimeout(r, 2000));

        const statusUrl = `${FAL_API_BASE}/${model}/requests/${requestId}/status`;
        const statusRes = await fetch(statusUrl, {
            headers: { "Authorization": `Key ${key}` },
        });

        if (!statusRes.ok) continue;
        const status = await statusRes.json();

        if (status.status === "COMPLETED") {
            const resultUrl = `${FAL_API_BASE}/${model}/requests/${requestId}`;
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

    throw new Error("Generation timed out — please try again");
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateTextToImage(req: TextToImageRequest): Promise<FalResult> {
    return falRequestWithPolling("fal-ai/flux-2/turbo", {
        prompt: req.prompt,
        image_size: req.image_size || "landscape_4_3",
        num_images: req.num_images || 1,
        guidance_scale: req.guidance_scale || 2.5,
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
        enable_safety_checker: req.enable_safety_checker ?? true,
        output_format: "png",
    });
}

export async function generateImageVariation(req: ImageVariationRequest): Promise<FalResult> {
    return falRequestWithPolling("fal-ai/flux-2/turbo/edit", {
        prompt: req.prompt,
        image_urls: [req.imageUrl],
        image_size: req.image_size || "landscape_4_3",
        num_images: req.num_images || 1,
        guidance_scale: req.guidance_scale || 2.5,
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
        enable_safety_checker: true,
        output_format: "png",
    });
}
