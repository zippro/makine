'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { Loader2, Calendar, Youtube, CheckCircle, Clock, ExternalLink, GripVertical } from 'lucide-react';
import { VideoJob } from '@/lib/types';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import YouTubePublishModal from '@/components/YouTubePublishModal';

type ColumnStatus = 'ready' | 'scheduled' | 'published';

export default function PublishPage() {
    const { currentProject } = useProject();
    const [jobs, setJobs] = useState<VideoJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState<VideoJob | null>(null);
    const [publishingJob, setPublishingJob] = useState<VideoJob | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ColumnStatus | null>(null);
    const [draggingJobId, setDraggingJobId] = useState<string | null>(null);

    useEffect(() => {
        if (currentProject) {
            fetch(`/api/jobs?projectId=${currentProject.id}&status=done`)
                .then(res => res.json())
                .then(data => setJobs(data))
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [currentProject]);

    // Refresh jobs periodically
    useEffect(() => {
        if (!currentProject) return;
        const interval = setInterval(() => {
            fetch(`/api/jobs?projectId=${currentProject.id}&status=done`)
                .then(res => res.json())
                .then(data => setJobs(data))
                .catch(console.error);
        }, 5000);
        return () => clearInterval(interval);
    }, [currentProject]);

    // ─── Drag & Drop ─────────────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, jobId: string) => {
        e.dataTransfer.setData('text/plain', jobId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingJobId(jobId);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, column: ColumnStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(column);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverColumn(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, targetColumn: ColumnStatus) => {
        e.preventDefault();
        setDragOverColumn(null);
        setDraggingJobId(null);

        const jobId = e.dataTransfer.getData('text/plain');
        if (!jobId) return;

        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        // Map column to youtube_status
        const statusMap: Record<ColumnStatus, string> = {
            'ready': 'none',
            'scheduled': 'scheduled',
            'published': 'published',
        };
        const newStatus = statusMap[targetColumn];

        // Check if already in this column
        const currentStatus = job.youtube_status || 'none';
        if (currentStatus === newStatus) return;
        if (targetColumn === 'ready' && (!currentStatus || currentStatus === 'none' || currentStatus === 'uploaded' || currentStatus === 'uploading')) return;

        // Update locally first for instant feedback
        setJobs(prev => prev.map(j =>
            j.id === jobId ? { ...j, youtube_status: newStatus } : j
        ));

        // Update in DB
        const supabase = createClient();
        const { error } = await supabase
            .from('video_jobs')
            .update({ youtube_status: newStatus })
            .eq('id', jobId);

        if (error) {
            console.error('[Publish] Status update error:', error);
            // Revert on error
            setJobs(prev => prev.map(j =>
                j.id === jobId ? { ...j, youtube_status: currentStatus } : j
            ));
        } else {
            console.log(`[Publish] Updated ${job.title_text} → ${newStatus}`);
        }
    }, [jobs]);

    const handleDragEnd = useCallback(() => {
        setDragOverColumn(null);
        setDraggingJobId(null);
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const scheduledJobs = jobs.filter(j => j.youtube_status === 'scheduled');
    const publishedJobs = jobs.filter(j => j.youtube_status === 'published');
    const readyJobs = jobs.filter(j => j.youtube_status !== 'scheduled' && j.youtube_status !== 'published');

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex justify-between items-center bg-card p-6 rounded-2xl border border-border">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                            Channel Timeline
                        </h1>
                        <p className="text-muted mt-1">Manage scheduling and YouTube publication for {currentProject?.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground hidden md:block">Drag videos between columns to change status</p>
                </header>

                {/* Timeline Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Ready to Publish */}
                    <DropColumn
                        title="Ready to Schedule"
                        count={readyJobs.length}
                        icon={<Clock className="w-5 h-5 text-blue-500" />}
                        column="ready"
                        isOver={dragOverColumn === 'ready'}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        emptyText="No videos ready."
                    >
                        {readyJobs.map(job => (
                            <JobCard
                                key={job.id}
                                job={job}
                                status="ready"
                                isDragging={draggingJobId === job.id}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onPreview={() => setSelectedVideo(job)}
                                onPublish={() => setPublishingJob(job)}
                            />
                        ))}
                    </DropColumn>

                    {/* Scheduled */}
                    <DropColumn
                        title="Scheduled"
                        count={scheduledJobs.length}
                        icon={<Calendar className="w-5 h-5 text-yellow-500" />}
                        column="scheduled"
                        isOver={dragOverColumn === 'scheduled'}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        emptyText="No videos scheduled."
                    >
                        {scheduledJobs.map(job => (
                            <JobCard
                                key={job.id}
                                job={job}
                                status="scheduled"
                                isDragging={draggingJobId === job.id}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onPreview={() => setSelectedVideo(job)}
                                onPublish={() => setPublishingJob(job)}
                            />
                        ))}
                    </DropColumn>

                    {/* Published */}
                    <DropColumn
                        title="Published"
                        count={publishedJobs.length}
                        icon={<Youtube className="w-5 h-5 text-red-600" />}
                        column="published"
                        isOver={dragOverColumn === 'published'}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        emptyText="No videos published."
                    >
                        {publishedJobs.map(job => (
                            <JobCard
                                key={job.id}
                                job={job}
                                status="published"
                                isDragging={draggingJobId === job.id}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onPreview={() => setSelectedVideo(job)}
                                onPublish={() => setPublishingJob(job)}
                            />
                        ))}
                    </DropColumn>
                </div>
            </div>

            {/* Preview Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVideo(null)}>
                    <div className="bg-card w-full max-w-4xl rounded-2xl overflow-hidden border border-border" onClick={e => e.stopPropagation()}>
                        <div className="aspect-video bg-black relative">
                            <video
                                src={selectedVideo.video_url || ''}
                                controls
                                autoPlay
                                className="w-full h-full"
                            />
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">{selectedVideo.title_text}</h3>
                                <p className="text-sm text-muted">Duration: {selectedVideo.duration_seconds ? `${Math.floor(selectedVideo.duration_seconds / 60)}:${(selectedVideo.duration_seconds % 60).toString().padStart(2, '0')}` : '--:--'}</p>
                            </div>
                            <div className="flex gap-2">
                                {(!selectedVideo.youtube_status || selectedVideo.youtube_status === 'none') && (
                                    <button
                                        onClick={() => { setSelectedVideo(null); setPublishingJob(selectedVideo); }}
                                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Youtube className="w-4 h-4" /> Publish
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedVideo(null)}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* YouTube Publish Modal */}
            {publishingJob && (
                <YouTubePublishModal
                    job={publishingJob}
                    isOpen={!!publishingJob}
                    onClose={() => setPublishingJob(null)}
                    channelInfo={currentProject?.channel_info}
                    keywords={currentProject?.keywords}
                />
            )}
        </div>
    );
}

// ─── Drop Column ─────────────────────────────────────────────────────────────

function DropColumn({ title, count, icon, column, isOver, onDragOver, onDragLeave, onDrop, emptyText, children }: {
    title: string;
    count: number;
    icon: React.ReactNode;
    column: ColumnStatus;
    isOver: boolean;
    onDragOver: (e: React.DragEvent, col: ColumnStatus) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, col: ColumnStatus) => void;
    emptyText: string;
    children: React.ReactNode;
}) {
    const borderColor = isOver
        ? column === 'published' ? 'border-green-500/50 bg-green-500/5' : column === 'scheduled' ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-blue-500/50 bg-blue-500/5'
        : '';

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                {icon} {title} ({count})
            </h3>
            <div
                className={`space-y-4 bg-muted/10 p-4 rounded-xl min-h-[500px] border-2 border-dashed transition-colors ${isOver ? borderColor : 'border-transparent'}`}
                onDragOver={(e) => onDragOver(e, column)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, column)}
            >
                {count === 0 && !isOver && <p className="text-muted text-sm text-center py-10">{emptyText}</p>}
                {isOver && count === 0 && (
                    <div className="text-center py-10">
                        <p className="text-sm font-medium text-primary animate-pulse">Drop here to move to {title}</p>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

// ─── Job Card ────────────────────────────────────────────────────────────────

function JobCard({ job, status, isDragging, onDragStart, onDragEnd, onPreview, onPublish }: {
    job: VideoJob;
    status: ColumnStatus;
    isDragging: boolean;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragEnd: () => void;
    onPreview: () => void;
    onPublish: () => void;
}) {
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, job.id)}
            onDragEnd={onDragEnd}
            className={`bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary/50 transition-all group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40 scale-95' : ''}`}
        >
            <div className="flex items-start gap-2 mb-3">
                <GripVertical className="w-4 h-4 text-muted flex-shrink-0 mt-1 opacity-40 group-hover:opacity-100 transition-opacity" />
                <div className="flex-1">
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative cursor-pointer" onClick={onPreview}>
                        {job.thumbnail_url || job.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={job.thumbnail_url || job.image_url || ''} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted text-xs">No Preview</div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                            </div>
                        </div>
                        {job.duration_seconds && (
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                {Math.floor(job.duration_seconds / 60)}:{(job.duration_seconds % 60).toString().padStart(2, '0')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <h4 className="font-medium text-sm line-clamp-2 mb-1" title={job.title_text}>{job.youtube_title || job.title_text}</h4>

            {status === 'scheduled' && (
                <div className="text-xs text-yellow-500 flex items-center gap-1 mb-2">
                    <Calendar className="w-3 h-3" />
                    {job.youtube_scheduled_at ? format(new Date(job.youtube_scheduled_at), 'MMM d, h:mm a') : 'Scheduled'}
                </div>
            )}
            {status === 'published' && (
                <div className="text-xs text-green-500 flex items-center gap-1 mb-2">
                    <CheckCircle className="w-3 h-3" />
                    Published
                    {job.youtube_id && (
                        <a href={`https://youtu.be/${job.youtube_id}`} target="_blank" rel="noopener noreferrer" className="ml-1 hover:text-green-400">
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onPreview(); }}
                    className="text-xs bg-white/5 hover:bg-white/10 text-foreground px-3 py-1.5 rounded-lg transition-colors border border-border"
                >
                    Preview
                </button>
                {status === 'ready' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPublish(); }}
                        className="text-xs bg-red-600/10 hover:bg-red-600/20 text-red-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <Youtube className="w-3 h-3" /> Publish / Schedule
                    </button>
                )}
                {status === 'scheduled' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPublish(); }}
                        className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Edit Schedule
                    </button>
                )}
                {status === 'published' && job.youtube_id && (
                    <a
                        href={`https://youtu.be/${job.youtube_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" /> View on YouTube
                    </a>
                )}
            </div>
        </div>
    );
}
