import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { submitToFal, getFalRequestStatus, getFalRequestResult, IMAGE_SIZE_PRESETS } from "@/lib/fal-client";
import type { FalResult } from "@/lib/fal-client";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { projectId, folder, baseImageId, prompt, numImages, seed, imageSize, action, statusUrl, responseUrl } = body;

        // ── Step 2: Poll status ──────────────────────────────────────────
        if (action === "status") {
            if (!statusUrl) {
                return NextResponse.json({ error: "statusUrl required" }, { status: 400 });
            }
            const status = await getFalRequestStatus(statusUrl);
            return NextResponse.json(status);
        }

        // ── Step 3: Fetch result and save ────────────────────────────────
        if (action === "save") {
            if (!responseUrl || !projectId) {
                return NextResponse.json({ error: "responseUrl and projectId required" }, { status: 400 });
            }
            const result = await getFalRequestResult(responseUrl) as FalResult;
            const targetFolder = folder || "/";
            const editPrompt = prompt || "Create a variation of this image";

            const assets = [];
            for (let i = 0; i < result.images.length; i++) {
                const img = result.images[i];
                const timestamp = Date.now();
                const filename = `var_${timestamp}_${i}.png`;

                const { data: asset, error: dbError } = await supabase
                    .from("images")
                    .insert({
                        url: img.url,
                        filename,
                        file_size: 0,
                        width: img.width,
                        height: img.height,
                        project_id: projectId,
                        folder: targetFolder,
                        source: "generated",
                        generation_meta: {
                            model: "fal-ai/flux-2/turbo/edit",
                            prompt: editPrompt,
                            baseImageId: baseImageId || null,
                            image_size: imageSize,
                            seed: result.seed,
                            index: i,
                            generated_at: new Date().toISOString(),
                        },
                    })
                    .select()
                    .single();

                if (dbError) {
                    console.error(`[Variations] DB insert error:`, dbError.message);
                    continue;
                }
                assets.push(asset);
            }

            if (assets.length === 0) {
                return NextResponse.json({ error: "Failed to save any variations" }, { status: 500 });
            }
            return NextResponse.json({ assets, seed: result.seed });
        }

        // ── Step 1: Submit (default) ─────────────────────────────────────
        if (!projectId) {
            return NextResponse.json({ error: "projectId is required" }, { status: 400 });
        }
        if (!baseImageId) {
            return NextResponse.json({ error: "Base image is required" }, { status: 400 });
        }

        // Fetch base image
        const { data: baseImage, error: fetchError } = await supabase
            .from("images")
            .select("*")
            .eq("id", baseImageId)
            .eq("project_id", projectId)
            .single();

        if (fetchError || !baseImage) {
            return NextResponse.json({ error: "Base image not found" }, { status: 404 });
        }

        const n = Math.min(Math.max(numImages || 1, 1), 4);
        const size = IMAGE_SIZE_PRESETS[imageSize] ? imageSize : "landscape_16_9";
        const editPrompt = prompt || "Create a variation of this image";

        console.log(`[Variations] Submitting ${n} variations of image ${baseImageId}`);

        const submitResult = await submitToFal("fal-ai/flux-2/turbo/edit", {
            prompt: editPrompt,
            image_urls: [baseImage.url],
            image_size: size,
            num_images: n,
            guidance_scale: 2.5,
            ...(seed !== undefined ? { seed } : {}),
            enable_safety_checker: true,
            output_format: "png",
        });

        console.log(`[Variations] Submitted, requestId: ${submitResult.requestId}`);
        return NextResponse.json({
            requestId: submitResult.requestId,
            statusUrl: submitResult.statusUrl,
            responseUrl: submitResult.responseUrl,
            status: "SUBMITTED",
        });

    } catch (error: any) {
        console.error("[Variations] Error:", error.message);
        return NextResponse.json(
            { error: error.message || "Variation generation failed" },
            { status: 500 }
        );
    }
}
