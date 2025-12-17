import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { N8nWebhookPayload } from '@/lib/types';

// POST /api/webhooks/n8n - Webhook for n8n to update job status
export async function POST(request: NextRequest) {
    try {
        // Verify webhook secret
        const authHeader = request.headers.get('authorization');
        const expectedSecret = process.env.WEBHOOK_SECRET;

        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse request body
        const body: N8nWebhookPayload = await request.json();

        // Validate required fields
        if (!body.job_id || !body.status) {
            return NextResponse.json(
                { error: 'Missing required fields: job_id, status' },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['queued', 'processing', 'done', 'error'];
        if (!validStatuses.includes(body.status)) {
            return NextResponse.json(
                { error: 'Invalid status value' },
                { status: 400 }
            );
        }

        // Use admin client to bypass RLS
        const supabase = createAdminClient();

        // Build update object
        const updateData: Record<string, unknown> = {
            status: body.status,
            updated_at: new Date().toISOString(),
        };

        if (body.video_url) {
            updateData.video_url = body.video_url;
        }
        if (body.thumbnail_url) {
            updateData.thumbnail_url = body.thumbnail_url;
        }
        if (body.duration_seconds) {
            updateData.duration_seconds = body.duration_seconds;
        }
        if (body.error_message) {
            updateData.error_message = body.error_message;
        }

        // Update the job
        const { data: job, error: updateError } = await supabase
            .from('video_jobs')
            .update(updateData)
            .eq('id', body.job_id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating job:', updateError);
            return NextResponse.json(
                { error: 'Failed to update job' },
                { status: 500 }
            );
        }

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, job });
    } catch (error) {
        console.error('Error in POST /api/webhooks/n8n:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
