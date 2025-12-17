'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Play, RefreshCw, Trash2, Youtube } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { JobStatusBadge } from './JobStatus';
import type { VideoJob } from '@/lib/types';

interface JobHistoryProps {
    limit?: number;
}

export function JobHistory({ limit }: JobHistoryProps) {
    const isVideoFile = (url: string | null) => {
        if (!url) return false;
        try {
            const path = new URL(url).pathname.toLowerCase();
            return path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov');
        } catch {
            return false;
        }
    };
    const [jobs, setJobs] = useState<VideoJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadJobs = async () => {
            const supabase = createClient();

            let query = supabase
                .from('video_jobs')
                .select('*')
                .order('created_at', { ascending: false });

            if (limit) {
                query = query.limit(limit);
            }

            const { data, error: fetchError } = await query;

            if (cancelled) return;

            if (fetchError) {
                setError('Failed to load job history');
                setLoading(false);
                return;
            }

            setJobs(data || []);
            setLoading(false);
        };

        loadJobs();

        return () => {
            cancelled = true;
        };
    }, [limit]);

    // Poll for updates
    useEffect(() => {
        const interval = setInterval(() => {
            // Only poll if there are active jobs or to catch new ones
            // For simplicity and to satisfy "change without refreshing", we poll always
            // but we can optimize to only update if we see a change? 
            // Rewriting loadJobs to be reusable without 'cancelled' variable closure issues
            handleRefresh();
        }, 5000);

        return () => clearInterval(interval);
    }, [limit]);

    const handleRefresh = async () => {
        // Don't set loading true for background refresh
        setError('');

        const supabase = createClient();

        let query = supabase
            .from('video_jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
            setError('Failed to load job history');
            setLoading(false);
            return;
        }

        setJobs(data || []);
        setLoading(false);
    };

    const handleDelete = async (e: React.MouseEvent, jobId: string) => {
        e.preventDefault(); // Prevent navigation
        e.stopPropagation();

        if (!confirm('Are you sure you want to delete this video? This will also delete the uploaded files.')) {
            return;
        }

        setDeletingId(jobId);

        try {
            const response = await fetch(`/api/jobs/${jobId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete');
            }

            // Remove from local state
            setJobs(jobs.filter(job => job.id !== jobId));
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete video. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (seconds: number | null): string => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-primary spinner" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-error mb-4">{error}</p>
                <button
                    onClick={handleRefresh}
                    className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <div className="text-center py-12">
                <Clock className="w-12 h-12 text-muted mx-auto mb-4" />
                <p className="text-muted">No videos generated yet</p>
                <p className="text-sm text-muted mt-1">
                    Create your first video to see it here
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {jobs.map((job) => (
                <div
                    key={job.id}
                    className="relative p-4 rounded-xl bg-card border border-border hover:border-primary/50 card-hover transition-all"
                >
                    <Link
                        href={`/jobs/${job.id}`}
                        className="block"
                    >
                        <div className="flex items-start gap-4">
                            {/* Thumbnail */}
                            <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-card-hover flex-shrink-0">
                                {job.thumbnail_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={job.thumbnail_url}
                                        alt={job.title_text}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            target.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-800 text-xs text-gray-500">Error</div>';
                                        }}
                                    />
                                ) : isVideoFile(job.image_url) ? (
                                    <video
                                        src={`${job.image_url}#t=0.1`}
                                        className="w-full h-full object-cover"
                                        muted
                                        loop
                                        playsInline
                                        crossOrigin="anonymous"
                                        preload="metadata"
                                        onMouseEnter={(e) => e.currentTarget.play()}
                                        onMouseLeave={(e) => e.currentTarget.pause()}
                                    />
                                ) : job.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={job.image_url}
                                        alt={job.title_text}
                                        className="w-full h-full object-cover opacity-50"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Play className="w-6 h-6 text-muted" />
                                    </div>
                                )}
                                {job.status === 'done' && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <Play className="w-6 h-6 text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-foreground truncate">
                                    {job.title_text}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <JobStatusBadge status={job.status} />
                                    <span className="text-xs text-muted">
                                        {formatDate(job.created_at)}
                                    </span>
                                    {job.duration_seconds && (
                                        <span className="text-xs text-muted">
                                            {formatDuration(job.duration_seconds)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Actions */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {job.status === 'done' && (
                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!confirm("Publish this video to YouTube?")) return;

                                    const btn = e.currentTarget;
                                    btn.disabled = true;
                                    btn.innerHTML = '...';

                                    try {
                                        const res = await fetch(`/api/jobs/${job.id}/publish`, { method: 'POST' });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.error);

                                        alert(`Published! URL: ${data.url}`);
                                    } catch (err: any) {
                                        alert('Upload Failed: ' + err.message);
                                    } finally {
                                        btn.disabled = false;
                                        // Reset icon (rudimentary re-render)
                                        btn.innerHTML = '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>';
                                    }
                                }}
                                className="p-2 rounded-lg bg-red-600/10 text-red-600 hover:bg-red-600/20 transition-colors disabled:opacity-50"
                                title="Publish to YouTube"
                            >
                                <Youtube className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={(e) => handleDelete(e, job.id)}
                            disabled={deletingId === job.id}
                            className="p-2 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                            title="Delete video"
                        >
                            {deletingId === job.id ? (
                                <RefreshCw className="w-4 h-4 spinner" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
