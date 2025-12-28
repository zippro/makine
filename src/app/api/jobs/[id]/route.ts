import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper to extract path from URL
// Helper to extract path from URL
function extractStoragePath(url: string, bucket: string): string | null {
    if (!url) return null;
    try {
        const regex = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
        const match = url.match(regex);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

// GET /api/jobs/:id - Get job details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        // Fetch the job (public access - no auth required)
        const { data: job, error: fetchError } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(job);
    } catch (error) {
        console.error('Error in GET /api/jobs/[id]:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/jobs/:id - Delete job and associated files
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        // First, get the job to find associated files
        const { data: job, error: fetchError } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Delete associated files from storage
        const filesToDelete: { bucket: string; path: string }[] = [];

        // Extract image path
        if (job.image_url) {
            const imagePath = extractStoragePath(job.image_url, 'images');
            if (imagePath) {
                filesToDelete.push({ bucket: 'images', path: imagePath });
            }
        }

        // Extract audio path
        if (job.audio_url) {
            const audioPath = extractStoragePath(job.audio_url, 'audio');
            if (audioPath) {
                filesToDelete.push({ bucket: 'audio', path: audioPath });
            }
        }

        // Delete files from each bucket
        for (const file of filesToDelete) {
            const { error: deleteFileError } = await supabase.storage
                .from(file.bucket)
                .remove([file.path]);

            if (deleteFileError) {
                console.error(`Error deleting file from ${file.bucket}:`, deleteFileError);
                // Continue even if file deletion fails
            }
        }

        // Delete the job record
        const { error: deleteError } = await supabase
            .from('video_jobs')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting job:', deleteError);
            return NextResponse.json(
                { error: 'Failed to delete job' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, message: 'Job and files deleted' });
    } catch (error) {
        console.error('Error in DELETE /api/jobs/[id]:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
