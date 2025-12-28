'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import { Loader2, Calendar, Youtube, CheckCircle, Clock } from 'lucide-react';
import { VideoJob } from '@/lib/types';
import { format } from 'date-fns';

export default function PublishPage() {
    const { currentProject } = useProject();
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState<any>(null);

    useEffect(() => {
        if (currentProject) {
            fetch(`/api/jobs?projectId=${currentProject.id}&status=done`)
                .then(res => res.json())
                .then(data => {
                    // Enhance jobs with youtube status (mock for now if not in DB yet)
                    setJobs(data);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [currentProject]);

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;



    const scheduledJobs = jobs.filter(j => j.youtube_status === 'scheduled');
    const publishedJobs = jobs.filter(j => j.youtube_status === 'published');
    const readyJobs = jobs.filter(j => !j.youtube_status || j.youtube_status === 'none' || j.youtube_status === 'uploaded');

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
                </header>

                {/* Timeline Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Ready to Publish */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                            <Clock className="w-5 h-5 text-blue-500" /> Ready to Schedule ({readyJobs.length})
                        </h3>
                        <div className="space-y-4 bg-muted/10 p-4 rounded-xl min-h-[500px]">
                            {readyJobs.length === 0 && <p className="text-muted text-sm text-center py-10">No videos ready.</p>}
                            {readyJobs.map(job => (
                                <JobCard key={job.id} job={job} status="ready" onPreview={() => setSelectedVideo(job)} />
                            ))}
                        </div>
                    </div>

                    {/* Scheduled */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                            <Calendar className="w-5 h-5 text-yellow-500" /> Scheduled ({scheduledJobs.length})
                        </h3>
                        <div className="space-y-4 bg-muted/10 p-4 rounded-xl min-h-[500px]">
                            {scheduledJobs.length === 0 && <p className="text-muted text-sm text-center py-10">No videos scheduled.</p>}
                            {scheduledJobs.map(job => (
                                <JobCard key={job.id} job={job} status="scheduled" onPreview={() => setSelectedVideo(job)} />
                            ))}
                        </div>
                    </div>

                    {/* Published */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                            <Youtube className="w-5 h-5 text-red-600" /> Published ({publishedJobs.length})
                        </h3>
                        <div className="space-y-4 bg-muted/10 p-4 rounded-xl min-h-[500px]">
                            {publishedJobs.length === 0 && <p className="text-muted text-sm text-center py-10">No videos published.</p>}
                            {publishedJobs.map(job => (
                                <JobCard key={job.id} job={job} status="published" onPreview={() => setSelectedVideo(job)} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVideo(null)}>
                    <div className="bg-card w-full max-w-4xl rounded-2xl overflow-hidden border border-border" onClick={e => e.stopPropagation()}>
                        <div className="aspect-video bg-black relative">
                            <video
                                src={selectedVideo.video_url || selectedVideo.url} // Handle various possible url fields
                                controls
                                autoPlay
                                className="w-full h-full"
                            />
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">{selectedVideo.title_text}</h3>
                                <p className="text-sm text-muted">Duration: {Math.floor(selectedVideo.duration_seconds / 60)}:{(selectedVideo.duration_seconds % 60).toString().padStart(2, '0')}</p>
                            </div>
                            <button
                                onClick={() => setSelectedVideo(null)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function JobCard({ job, status, onPreview }: { job: any, status: 'ready' | 'scheduled' | 'published', onPreview: () => void }) {
    return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary/50 transition-all group">
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative mb-3 cursor-pointer" onClick={onPreview}>
                {/* Thumbnail */}
                {job.thumbnail_url || job.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.thumbnail_url || job.image_url} className="w-full h-full object-cover" alt="" />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted text-xs">No Preview</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                    </div>
                </div>
                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {Math.floor(job.duration_seconds / 60)}:{(job.duration_seconds % 60).toString().padStart(2, '0')}
                </div>
            </div>

            <h4 className="font-medium text-sm line-clamp-2 mb-1" title={job.title_text}>{job.youtube_title || job.title_text}</h4>

            {status === 'scheduled' && (
                <div className="text-xs text-yellow-500 flex items-center gap-1 mb-2">
                    <Calendar className="w-3 h-3" />
                    {job.youtube_scheduled_at ? format(new Date(job.youtube_scheduled_at), 'MMM d, h:mm a') : 'Unscheduled'}
                </div>
            )}
            {status === 'published' && (
                <div className="text-xs text-green-500 flex items-center gap-1 mb-2">
                    <CheckCircle className="w-3 h-3" />
                    Published
                </div>
            )}

            <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onPreview(); }}
                    className="text-xs bg-white/5 hover:bg-white/10 text-foreground px-3 py-1.5 rounded-lg transition-colors border border-border"
                >
                    Preview
                </button>
                <button className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors">
                    {status === 'ready' ? 'Schedule' : 'Edit Details'}
                </button>
            </div>
        </div>
    )
}
