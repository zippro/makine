import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateImageVariation, IMAGE_SIZE_PRESETS } from "@/lib/fal-client";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { projectId, folder, baseImageId, prompt, numImages, seed, imageSize } = body;

        // Validation
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
        const targetFolder = folder || baseImage.folder || "/";
        const editPrompt = prompt || "Create a variation of this image";

        console.log(`[Variations] Generating ${n} variations of image ${baseImageId}`);

        // Call fal.ai Flux 2 Turbo Edit
        const startTime = Date.now();
        const result = await generateImageVariation({
            imageUrl: baseImage.url,
            prompt: editPrompt,
            num_images: n,
            seed: seed !== undefined ? seed : undefined,
            image_size: size,
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Variations] Generated ${result.images.length} variations in ${elapsed}s`);

        // Store fal.ai URLs directly in the DB (skip re-upload to save time)
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
                        baseImageId,
                        baseImageUrl: baseImage.url,
                        image_size: size,
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

        console.log(`[Variations] Saved ${assets.length} images to folder "${targetFolder}"`);
        return NextResponse.json({ assets, seed: result.seed });

    } catch (error: any) {
        console.error("[Variations] Error:", error.message);
        return NextResponse.json(
            { error: error.message || "Variation generation failed" },
            { status: 500 }
        );
    }
}
