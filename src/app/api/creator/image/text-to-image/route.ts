import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateTextToImage, IMAGE_SIZE_PRESETS } from "@/lib/fal-client";

export const maxDuration = 60; // fal.ai can take a moment

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { projectId, folder, prompt, numImages, imageSize, seed } = body;

        // Validation
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
        const targetFolder = folder || "/";

        console.log(`[T2I] Generating ${n} image(s): "${prompt.substring(0, 60)}..." size=${size}`);

        // Call fal.ai
        const startTime = Date.now();
        const result = await generateTextToImage({
            prompt: prompt.trim(),
            image_size: size,
            num_images: n,
            seed: seed !== undefined ? seed : undefined,
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[T2I] Generated ${result.images.length} images in ${elapsed}s`);

        // Store fal.ai URLs directly in the DB (skip re-upload to save time)
        const assets = [];
        for (let i = 0; i < result.images.length; i++) {
            const img = result.images[i];
            const timestamp = Date.now();
            const filename = `gen_${timestamp}_${i}.png`;

            // Create database record with the fal.ai image URL directly
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
                        prompt: prompt.trim(),
                        model: "fal-ai/flux-2/turbo",
                        image_size: size,
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

        if (assets.length === 0) {
            return NextResponse.json({ error: "Failed to save any generated images" }, { status: 500 });
        }

        console.log(`[T2I] Saved ${assets.length} images to folder "${targetFolder}"`);
        return NextResponse.json({ assets, seed: result.seed });

    } catch (error: any) {
        console.error("[T2I] Error:", error.message);
        return NextResponse.json(
            { error: error.message || "Generation failed" },
            { status: 500 }
        );
    }
}
