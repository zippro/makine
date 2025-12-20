import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/upload - Upload file to storage and save to images table
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const projectId = formData.get('project_id') as string;

        if (!file || !projectId) {
            return NextResponse.json(
                { error: 'Missing file or project_id' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to storage
        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(fileName, buffer, {
                contentType: file.type,
                cacheControl: '3600'
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return NextResponse.json(
                { error: 'Failed to upload file to storage' },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(fileName);

        // Save to images table
        const { data: imageRecord, error: dbError } = await supabase
            .from('images')
            .insert({
                url: publicUrl,
                filename: file.name,
                file_size: file.size,
                project_id: projectId
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database insert error:', dbError);
            return NextResponse.json(
                { error: 'Failed to save image record' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            url: publicUrl,
            image: imageRecord
        }, { status: 201 });

    } catch (error) {
        console.error('Error in POST /api/upload:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
