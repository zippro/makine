'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Download, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { JobStatus } from '@/components/JobStatus';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { VideoJob } from '@/lib/types';

export default function JobDetailPage() {
    const params = useParams();
    const router = useRouter();
    const jobId = params.id as string;

    const isVideoFile = (url: string | null) => {
        if (!url) return false;
        const lower = url.toLowerCase();
        return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
    };

    const [job, setJob] = useState<VideoJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const fetchJob = async () => {
            const supabase = createClient();

            const { data, error } = await supabase
                .from('video_jobs')
                .select('*')
                .eq('id', jobId)
                .single();

            if (error) {
                setError('Job not found');
                setLoading(false);
                return;
            }

            setJob(data);
            setLoading(false);
        };

        fetchJob();
    }, [jobId]);

    const handleJobComplete = (completedJob: VideoJob) => {
        setJob(completedJob);
    };

    const handleShare = async () => {
        if (job?.video_url) {
            try {
                await navigator.share({
                    title: job.title_text,
                    text: `Check out this music video: ${job.title_text}`,
                    url: job.video_url,
                });
            } catch {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(job.video_url);
                alert('Video URL copied to clipboard!');
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-primary spinner" />
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-error">{error || 'Job not found'}</p>
                <Link
                    href="/"
                    className="text-primary hover:text-primary-hover transition-colors"
                >
                    ← Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>

                    {job.status === 'done' && job.video_url && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border hover:bg-card-hover transition-colors text-sm"
                            >
                                <Share2 className="w-4 h-4" />
                                Share
                            </button>
                            <a
                                href={job.video_url}
                                download={`${job.title_text}.mp4`}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Download
                            </a>
                        </div>
                    )}
                </div>

                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                        {job.title_text}
                    </h1>
                    <p className="text-muted text-sm mt-2">
                        Created {new Date(job.created_at).toLocaleString()}
                    </p>
                </div>

                {/* Status or Video */}
                {job.status === 'done' && job.video_url ? (
                    <div className="space-y-6">
                        <VideoPlayer
                            src={job.video_url}
                            title={job.title_text}
                            poster={job.thumbnail_url || undefined}
                        />

                        {/* Metadata */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-card border border-border">
                                <p className="text-xs text-muted mb-1">Duration</p>
                                <p className="font-medium text-foreground">
                                    {job.duration_seconds
                                        ? `${Math.floor(job.duration_seconds / 60)}:${(job.duration_seconds % 60).toString().padStart(2, '0')}`
                                        : '--:--'
                                    }
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-card border border-border">
                                <p className="text-xs text-muted mb-1">Status</p>
                                <p className="font-medium text-success">Complete</p>
                            </div>
                            <div className="p-4 rounded-xl bg-card border border-border">
                                <p className="text-xs text-muted mb-1">Format</p>
                                <p className="font-medium text-foreground">MP4</p>
                            </div>
                            <div className="p-4 rounded-xl bg-card border border-border">
                                <p className="text-xs text-muted mb-1">Title Overlay</p>
                                <p className="font-medium text-foreground">At 7s</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <JobStatus
                            jobId={job.id}
                            initialStatus={job.status}
                            onComplete={handleJobComplete}
                        />

                        {/* Preview of source files */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-card border border-border">
                                <p className="text-sm text-muted mb-3">Source Image</p>
                                <div className="aspect-video rounded-lg overflow-hidden bg-card-hover">
                                    {isVideoFile(job.image_url) ? (
                                        <video
                                            src={`${job.image_url}#t=0.1`}
                                            className="w-full h-full object-cover"
                                            controls
                                            muted
                                            loop
                                            playsInline
                                            preload="metadata"
                                        />
                                    ) : (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={job.image_url}
                                            alt="Source image"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-card border border-border">
                                <p className="text-sm text-muted mb-3">Audio Track</p>
                                <audio
                                    src={job.audio_url}
                                    controls
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Another */}
                <div className="mt-12 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-foreground"
                    >
                        Create Another Video
                    </Link>
                </div>
            </div>
        </div>
    );
}
