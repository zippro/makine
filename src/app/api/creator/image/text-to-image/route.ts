import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { submitToFal, getFalRequestStatus, getFalRequestResult, IMAGE_SIZE_PRESETS } from "@/lib/fal-client";
import type { FalResult } from "@/lib/fal-client";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { projectId, folder, prompt, numImages, imageSize, seed, action, requestId } = body;

        // ── Step 2: Poll status ──────────────────────────────────────────
        if (action === "status") {
            if (!requestId) {
                return NextResponse.json({ error: "requestId required" }, { status: 400 });
            }
            const status = await getFalRequestStatus("fal-ai/flux-2/turbo", requestId);
            return NextResponse.json(status);
        }

        // ── Step 3: Fetch result and save ────────────────────────────────
        if (action === "save") {
            if (!requestId || !projectId) {
                return NextResponse.json({ error: "requestId and projectId required" }, { status: 400 });
            }
            const result = await getFalRequestResult("fal-ai/flux-2/turbo", requestId) as FalResult;
            const targetFolder = folder || "/";
            const assets = await saveImages(supabase, result, projectId, targetFolder, prompt || "");
            return NextResponse.json({ assets, seed: result.seed });
        }

        // ── Step 1: Submit (default) ─────────────────────────────────────
        if (!projectId) {
            return NextResponse.json({ error: "projectId is required" }, { status: 400 });
        }
        if (!prompt || prompt.trim().length === 0) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }
        if (prompt.length > 2000) {
            return NextResponse.json({ error: "Prompt too long (max 2000 chars)" }, { status: 400 });
        }

        const n = Math.min(Math.max(numImages || 1, 1), 4);
        const size = IMAGE_SIZE_PRESETS[imageSize] ? imageSize : "landscape_16_9";

        console.log(`[T2I] Submitting ${n} image(s): "${prompt.substring(0, 60)}..." size=${size}`);

        const { requestId: falRequestId } = await submitToFal("fal-ai/flux-2/turbo", {
            prompt: prompt.trim(),
            image_size: size,
            num_images: n,
            guidance_scale: 2.5,
            ...(seed !== undefined ? { seed } : {}),
            enable_safety_checker: true,
            output_format: "png",
        });

        console.log(`[T2I] Submitted, requestId: ${falRequestId}`);
        return NextResponse.json({ requestId: falRequestId, status: "SUBMITTED" });

    } catch (error: any) {
        console.error("[T2I] Error:", error.message);
        return NextResponse.json(
            { error: error.message || "Generation failed" },
            { status: 500 }
        );
    }
}

// Helper: save fal.ai images to DB
async function saveImages(
    supabase: any,
    result: FalResult,
    projectId: string,
    folder: string,
    prompt: string
) {
    const assets = [];
    for (let i = 0; i < result.images.length; i++) {
        const img = result.images[i];
        const timestamp = Date.now();
        const filename = `gen_${timestamp}_${i}.png`;

        const { data: asset, error: dbError } = await supabase
            .from("images")
            .insert({
                url: img.url,
                filename,
                file_size: 0,
                width: img.width,
                height: img.height,
                project_id: projectId,
                folder,
                source: "generated",
                generation_meta: {
                    prompt,
                    model: "fal-ai/flux-2/turbo",
                    seed: result.seed,
                    index: i,
                    generated_at: new Date().toISOString(),
                },
            })
            .select()
            .single();

        if (dbError) {
            console.error(`[T2I] DB insert error:`, dbError.message);
            continue;
        }
        assets.push(asset);
    }
    return assets;
}
