'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { VideoJob, JobStatus } from '@/lib/types';

interface JobStatusProps {
    jobId: string;
    initialStatus?: JobStatus;
    onComplete?: (job: VideoJob) => void;
}

const statusConfig: Record<JobStatus, { icon: React.ReactNode; label: string; color: string }> = {
    queued: {
        icon: <Clock className="w-5 h-5" />,
        label: 'Queued',
        color: 'text-warning',
    },
    processing: {
        icon: <Loader2 className="w-5 h-5 spinner" />,
        label: 'Processing',
        color: 'text-primary',
    },
    done: {
        icon: <CheckCircle className="w-5 h-5" />,
        label: 'Complete',
        color: 'text-success',
    },
    error: {
        icon: <XCircle className="w-5 h-5" />,
        label: 'Error',
        color: 'text-error',
    },
};

export function JobStatus({ jobId, initialStatus = 'queued', onComplete }: JobStatusProps) {
    const [status, setStatus] = useState<JobStatus>(initialStatus);
    const [job, setJob] = useState<VideoJob | null>(null);
    const [error, setError] = useState<string>('');
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    useEffect(() => {
        const supabase = createClient();

        // Fetch initial job data
        const fetchJob = async () => {
            const { data, error } = await supabase
                .from('video_jobs')
                .select('*')
                .eq('id', jobId)
                .single();

            if (error) {
                setError('Failed to fetch job status');
                return;
            }

            setJob(data);
            setStatus(data.status);

            // Set start time if processing
            const start = new Date(data.created_at).getTime();
            setStartTime(start);
        }

        if (data.status === 'done' && onComplete) {
            onComplete(data);
        }
    };

    fetchJob();

    // Subscribe to realtime updates
    const channel = supabase
        .channel(`job-${jobId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'video_jobs',
                filter: `id=eq.${jobId}`,
            },
            (payload) => {
                const updatedJob = payload.new as VideoJob;
                setJob(updatedJob);
                setStatus(updatedJob.status);

                if (updatedJob.status === 'processing' && status !== 'processing') {
                    setStartTime(Date.now());
                }

                if (updatedJob.status === 'done' && onComplete) {
                    onComplete(updatedJob);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}, [jobId, onComplete, status]);

// Polling fallback
useEffect(() => {
    if (status === 'done' || status === 'error') return;

    const pollInterval = setInterval(async () => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (!error && data) {
            // Use functional update to access latest state without adding to dependencies
            setJob(prevJob => {
                if (!prevJob) return data;
                // Check if anything relevant changed
                if (prevJob.status !== data.status || prevJob.progress !== data.progress) {
                    setStatus(data.status);
                    // Also update start time if just started
                    if (data.status === 'processing' && prevJob.status !== 'processing') {
                        setStartTime(new Date(data.created_at).getTime());
                    } return data;
                }
                return prevJob;
            });
        }
    }, 1000); // Poll every 1 second for smoother progress

    return () => clearInterval(pollInterval);
}, [jobId, status, onComplete]);

// Timer effect
useEffect(() => {
    if (status === 'processing' && startTime) {
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }
}, [status, startTime]);

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const config = statusConfig[status];
const isStalled = elapsedSeconds > 1800; // 30 minutes (User requested to hide this warning)

return (
    <div className="p-6 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`${config.color}`}>
                    {config.icon}
                </div>
                <div>
                    <p className="font-medium text-foreground">{config.label}</p>
                    <p className="text-sm text-muted">Job ID: {jobId.slice(0, 8)}...</p>
                </div>
            </div>

            {status === 'processing' && (
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                        {/* Show percentage if available */}
                        {typeof (job as any)?.progress === 'number' && (job as any).progress > 0 && (
                            <span className="text-sm font-medium text-primary">
                                {job?.progress}%
                            </span>
                        )}
                        <span className="text-sm font-medium tabular-nums text-muted">
                            {formatTime(elapsedSeconds)}
                        </span>
                    </div>
                    {/* Progress Bar Container */}
                    <div className="w-32 h-2 rounded-full bg-secondary overflow-hidden relative">
                        {/* Indeterminate loader background */}
                        <div className="absolute inset-0 h-full w-full bg-primary/20 animate-pulse" />

                        {/* Actual percentage bar if available */}
                        {typeof job?.progress === 'number' && job.progress > 0 && (
                            <div
                                className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out"
                                style={{ width: `${job.progress}%` }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>

        {error && (
            <p className="mt-4 text-sm text-error">{error}</p>
        )}

        {job?.error_message && status === 'error' && (
            <p className="mt-4 text-sm text-error bg-error/10 p-3 rounded-lg">
                {job.error_message}
            </p>
        )}

        {status === 'processing' && (
            <div className="mt-4 space-y-2">
                <p className="text-sm text-muted">
                    Your video is being generated ({formatTime(elapsedSeconds)} elapsed).
                    <br />
                    Length depends on audio duration ~10s logic.
                </p>
                {isStalled && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>
                            This is taking longer than usual. The system may be busy or retrying.
                            If it doesn't complete in a few minutes, please try again.
                        </p>
                    </div>
                )}
            </div>
        )}

        {status === 'queued' && (
            <p className="mt-4 text-sm text-muted">
                Your job is in the queue. Processing will begin shortly.
            </p>
        )}
    </div>
);
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
    const config = statusConfig[status];

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} bg-current/10`}>
            {config.icon}
            {config.label}
        </span>
    );
}
