/**
 * YouTube Upload Worker — runs on Hetzner VPS
 * 
 * Reads video from local disk → uploads directly to YouTube → updates Supabase DB.
 * No timeout, no middleman. Just disk → YouTube.
 * 
 * Usage: node youtube_upload_worker.js
 * Runs on port 3002
 * 
 * Endpoints:
 *   POST /youtube-upload  — Start a YouTube upload
 *     Body: { jobId, videoPath, title, description, tags, privacyStatus, publishAt, 
 *             clientId, clientSecret, refreshToken, supabaseUrl, supabaseKey }
 *   GET  /youtube-status/:jobId — Check upload progress
 *   GET  /health — Health check
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Track active uploads { jobId: { percent, status, error, youtubeId } }
const activeUploads = {};

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
    res.json({ status: 'ok', activeUploads: Object.keys(activeUploads).length });
});

// ─── Upload Status ───────────────────────────────────────────────────────────

app.get('/youtube-status/:jobId', (req, res) => {
    const status = activeUploads[req.params.jobId];
    if (!status) return res.json({ status: 'unknown' });
    res.json(status);
});

// ─── YouTube Upload ──────────────────────────────────────────────────────────

app.post('/youtube-upload', async (req, res) => {
    const {
        jobId, videoPath, videoUrl,
        title, description, tags, privacyStatus, publishAt,
        clientId, clientSecret, refreshToken,
        supabaseUrl, supabaseKey
    } = req.body;

    if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
    if (!clientId || !clientSecret || !refreshToken) return res.status(400).json({ error: 'Missing YouTube credentials' });
    if (!supabaseUrl || !supabaseKey) return res.status(400).json({ error: 'Missing Supabase credentials' });

    // Determine video file path
    let filePath = videoPath;
    if (!filePath && videoUrl) {
        // Extract filename from URL like https://46.62.209.244.nip.io/videos/abc.mp4
        const urlPath = new URL(videoUrl).pathname; // /videos/abc.mp4
        filePath = path.join('/var/www', urlPath); // /var/www/videos/abc.mp4
    }

    if (!filePath || !fs.existsSync(filePath)) {
        console.error(`[YT-Upload] File not found: ${filePath}`);
        return res.status(400).json({ error: `Video file not found: ${filePath}` });
    }

    // Respond immediately — upload happens in background
    activeUploads[jobId] = { status: 'uploading', percent: 0, message: 'Starting...' };
    res.json({ success: true, message: 'Upload started', jobId });

    // ── Background upload ──
    const startTime = Date.now();
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Mark as uploading in DB
        await supabase.from('video_jobs').update({ youtube_status: 'uploading' }).eq('id', jobId);

        // Get file size
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;
        console.log(`[YT-Upload] Job ${jobId}: ${filePath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

        // Set up OAuth2
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // Create read stream
        const videoStream = fs.createReadStream(filePath);

        // Track progress
        let bytesUploaded = 0;
        videoStream.on('data', (chunk) => {
            bytesUploaded += chunk.length;
            const pct = Math.round((bytesUploaded / fileSize) * 100);
            activeUploads[jobId] = {
                status: 'uploading',
                percent: pct,
                message: `Uploading: ${pct}% (${(bytesUploaded / 1024 / 1024).toFixed(0)}/${(fileSize / 1024 / 1024).toFixed(0)} MB)`
            };
        });

        // Upload to YouTube
        activeUploads[jobId].message = 'Starting YouTube upload...';

        const uploadRes = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: (title || 'My Video').substring(0, 100),
                    description: description || 'Created with Makine Video AI',
                    tags: Array.isArray(tags) ? tags : ['music', 'video'],
                    categoryId: '22',
                },
                status: {
                    privacyStatus: privacyStatus || 'private',
                    selfDeclaredMadeForKids: false,
                    publishAt: publishAt || undefined,
                },
            },
            media: {
                body: videoStream,
            },
        });

        const youtubeId = uploadRes.data.id;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const ytStatus = publishAt ? 'scheduled' : 'published';

        console.log(`[YT-Upload] ✅ Job ${jobId}: ${ytStatus} as ${youtubeId} in ${elapsed}s`);

        // Update DB
        const updateData = {
            youtube_status: ytStatus,
            youtube_id: youtubeId,
        };
        if (publishAt) updateData.youtube_scheduled_at = publishAt;

        const { error: dbError } = await supabase
            .from('video_jobs')
            .update(updateData)
            .eq('id', jobId);

        if (dbError) console.error('[YT-Upload] DB error:', dbError);

        activeUploads[jobId] = {
            status: 'success',
            percent: 100,
            message: `${ytStatus === 'scheduled' ? 'Scheduled' : 'Published'} in ${elapsed}s`,
            youtubeId,
            url: `https://youtu.be/${youtubeId}`,
        };

        // Clean up after 5 minutes
        setTimeout(() => { delete activeUploads[jobId]; }, 5 * 60 * 1000);

    } catch (err) {
        console.error(`[YT-Upload] ❌ Job ${jobId}:`, err.message);

        // Reset status in DB
        await supabase.from('video_jobs').update({ youtube_status: 'none' }).eq('id', jobId).catch(() => { });

        activeUploads[jobId] = {
            status: 'error',
            percent: 0,
            message: err.message || 'Upload failed',
        };

        // Clean up after 5 minutes
        setTimeout(() => { delete activeUploads[jobId]; }, 5 * 60 * 1000);
    }
});

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[YT-Upload] YouTube Upload Worker running on port ${PORT}`);
});
