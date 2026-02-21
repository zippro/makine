import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateImageVariation, IMAGE_SIZE_PRESETS } from "@/lib/fal-client";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { projectId, folder, baseImageId, numImages, strength, seed, imageSize } = body;

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

        // Map strength label to value
        const strengthMap: Record<string, number> = {
            low: 0.3,
            medium: 0.6,
            high: 0.85,
        };
        const strengthValue = strengthMap[strength] || 0.6;

        console.log(`[Variations] Generating ${n} variations of image ${baseImageId}, strength=${strengthValue}`);

        // Call fal.ai
        const startTime = Date.now();
        const result = await generateImageVariation({
            imageUrl: baseImage.url,
            num_images: n,
            strength: strengthValue,
            seed: seed !== undefined ? seed : undefined,
            image_size: size,
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Variations] Generated ${result.images.length} variations in ${elapsed}s`);

        // Download and save
        const assets = [];
        for (let i = 0; i < result.images.length; i++) {
            const img = result.images[i];
            const timestamp = Date.now();
            const filename = `var_${timestamp}_${i}.png`;
            const storagePath = `${projectId}/${filename}`;

            // Download from fal.ai
            const imgRes = await fetch(img.url);
            if (!imgRes.ok) {
                console.error(`[Variations] Failed to download image ${i}:`, imgRes.status);
                continue;
            }
            const imgBuffer = await imgRes.arrayBuffer();

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from("images")
                .upload(storagePath, imgBuffer, {
                    contentType: img.content_type || "image/png",
                    upsert: false,
                });

            if (uploadError) {
                console.error(`[Variations] Storage upload error:`, uploadError.message);
                continue;
            }

            const { data: urlData } = supabase.storage
                .from("images")
                .getPublicUrl(storagePath);

            const publicUrl = urlData.publicUrl;

            const { data: asset, error: dbError } = await supabase
                .from("images")
                .insert({
                    url: publicUrl,
                    filename,
                    file_size: imgBuffer.byteLength,
                    width: img.width,
                    height: img.height,
                    project_id: projectId,
                    folder: targetFolder,
                    source: "generated",
                    generation_meta: {
                        model: "fal-ai/flux/schnell/redux",
                        baseImageId,
                        baseImageUrl: baseImage.url,
                        image_size: size,
                        strength: strengthValue,
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
