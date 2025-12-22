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

        // HETZNER PROXY UPLOAD
        // Use 'images' type for this route (it's the Images API essentially)
        const type = 'images';

        try {
            const serverIp = process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244';
            const uploadEndpoint = `https://${serverIp}.nip.io/upload`;

            const proxyFormData = new FormData();
            proxyFormData.append('type', type);
            proxyFormData.append('file', file, fileName);

            const uploadRes = await fetch(uploadEndpoint, {
                method: 'POST',
                body: proxyFormData
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Hetzner Upload Failed: ${errText}`);
            }

            const uploadData = await uploadRes.json();
            const publicUrl = uploadData.url;

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

        } catch (uploadErr) {
            console.error('Proxy Error:', uploadErr);
            return NextResponse.json(
                { error: 'Failed to upload to external storage' },
                { status: 502 }
            );
        }
    } catch (error) {
        console.error('Error in POST /api/upload:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
