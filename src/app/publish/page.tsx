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
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-purple-600">
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
                                <JobCard key={job.id} job={job} status="ready" />
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
                                <JobCard key={job.id} job={job} status="scheduled" />
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
                                <JobCard key={job.id} job={job} status="published" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function JobCard({ job, status }: { job: any, status: 'ready' | 'scheduled' | 'published' }) {
    return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary/50 transition-all group">
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative mb-3">
                {/* Thumbnail */}
                {job.thumbnail_url ? (
                    <img src={job.thumbnail_url} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted text-xs">No Preview</div>
                )}
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
                <button className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors">
                    {status === 'ready' ? 'Schedule' : 'Edit Details'}
                </button>
            </div>
        </div>
    )
}
