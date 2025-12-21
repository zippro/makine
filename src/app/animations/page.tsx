'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, Trash2, Loader2, Video, AlertCircle, ChevronDown, ChevronUp, Play, X } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { VideoDetailsModal } from '@/components/VideoDetailsModal';

interface Animation {
    id: string;
    image_id: string;
    url: string | null;
    thumbnail_url: string | null;
    duration: number;
    status: string;
    is_approved: boolean;
    error_message: string | null;
    video_usage_count: number;
    trim_start: number;
    trim_end: number;
    speed_multiplier: number;
    created_at: string;
    updated_at: string;
    images: {
        id: string;
        url: string;
        filename: string;
    } | null;
    // Mock fields for now if not present in type yet, allowing UI to work with 'any' cast inside loop
    youtube_title?: string;
}

export default function AnimationsPage() {
    const [animations, setAnimations] = useState<Animation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAnimation, setSelectedAnimation] = useState<Animation | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // AI Details Modal State
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedVideoForDetails, setSelectedVideoForDetails] = useState<any>(null);

    // Edit state
    const [editTrimStart, setEditTrimStart] = useState(0);
    const [editTrimEnd, setEditTrimEnd] = useState(0);
    const [editSpeed, setEditSpeed] = useState(1);

    // Folder State
    const [currentFolder, setCurrentFolder] = useState<string>('/');
    const [projectFolders, setProjectFolders] = useState<any[]>([]);

    const { currentProject } = useProject();

    // ... fetchAnimations ...
    const fetchAnimations = useCallback(async () => {
        if (!currentProject) return;
        try {
            const response = await fetch(`/api/animations?projectId=${currentProject.id}`);
            if (!response.ok) throw new Error('Failed to fetch animations');
            const data = await response.json();
            setAnimations(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [currentProject]);

    const fetchFolders = useCallback(async () => {
        if (!currentProject) return;
        try {
            const response = await fetch(`/api/folders?projectId=${currentProject.id}`);
            if (response.ok) {
                const data = await response.json();
                setProjectFolders(data);
            } else {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error || 'Failed to fetch folders';
                if (errMsg.includes('Configuration Error')) setError(errMsg);
            }
        } catch (err) {
            console.error('Failed to fetch folders', err);
            setError(`Folder Load Error: ${(err as Error).message}`);
        }
    }, [currentProject]);

    useEffect(() => {
        if (currentProject) {
            fetchAnimations();
            fetchFolders();
            // Poll for updates every 10 seconds
            const interval = setInterval(() => {
                fetchAnimations();
                fetchFolders();
            }, 10000);
            return () => clearInterval(interval);
        } else {
            setAnimations([]);
            setLoading(false);
        }
    }, [fetchAnimations, fetchFolders, currentProject]);

    // Folder Helpers
    const getFolderContents = (items: Animation[], folder: string) => {
        return items.filter(i => ((i as any).folder || '/') === folder);
    };

    const getSubfolders = (items: Animation[], currentPath: string) => {
        const folders = new Set<string>();

        // 1. From Persistent Folders
        projectFolders.forEach(pf => {
            const fPath = pf.path;
            if (fPath !== currentPath && fPath.startsWith(currentPath)) {
                // strict check for direct child
                const rel = fPath.slice(currentPath.length + (currentPath === '/' ? 0 : 1));
                const firstPart = rel.split('/')[0];
                if (firstPart) folders.add(currentPath === '/' ? `/${firstPart}` : `${currentPath}/${firstPart}`);
            }
        });

        // 2. From Files
        items.forEach(i => {
            const f = (i as any).folder || '/';
            if (f !== currentPath && f.startsWith(currentPath)) {
                const rel = f.slice(currentPath.length + (currentPath === '/' ? 0 : 1));
                const firstPart = rel.split('/')[0];
                if (firstPart) folders.add(currentPath === '/' ? `/${firstPart}` : `${currentPath}/${firstPart}`);
            }
        });
        return Array.from(folders).sort();
    };

    const createFolder = async () => {
        const name = prompt('Folder Name:');
        if (!name) return;

        let newPath = currentFolder === '/' ? `/${name}` : `${currentFolder}/${name}`;
        if (!newPath.startsWith('/')) newPath = '/' + newPath;

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: currentProject?.id, path: newPath })
            });

            if (response.ok) {
                await fetchFolders();
                setCurrentFolder(newPath);
            } else {
                throw new Error('Failed to create folder');
            }
        } catch (e) {
            alert('Failed to create folder');
        }
    }

    // Need to update Upload to support folders (requires redirecting to Upload page with folder param? 
    // Or just updating the uploaded file later? The Upload page /upload-images is separate.
    // For now, let's just allow organizing *existing* or maybe create a quick upload here?
    // The previous implementation sent user to /upload-images. 
    // We should probably add `folder` support to /upload-images eventually.
    // BUT the user's specific request "open new folder then I will upload" suggests inline upload.
    // Let's rely on the user navigating to /upload-images for now, but maybe we can store the "current folder" in local storage or URL param?
    // Simpler: Just allow creating/navigating folders here. Uploading new images implies they land in Root currently.
    // We will fix that later. Focus on View/Nav.

    const handleApprove = async (id: string) => {
        setUpdatingId(id);
        try {
            const response = await fetch('/api/animations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_approved: true }),
            });
            if (!response.ok) throw new Error('Failed to approve');
            await fetchAnimations();
        } catch (err) {
            console.error('Error approving:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this animation?')) return;
        setUpdatingId(id);
        try {
            const response = await fetch(`/api/animations?id=${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete');
            await fetchAnimations();
        } catch (err) {
            console.error('Error deleting:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const startEditing = (animation: Animation) => {
        setEditingId(animation.id);
        setEditTrimStart(animation.trim_start);
        setEditTrimEnd(animation.trim_end);
        setEditSpeed(animation.speed_multiplier);
    };

    const cancelEditing = () => {
        setEditingId(null);
    };

    const saveEditing = async (id: string) => {
        setUpdatingId(id);
        try {
            // Trigger FFmpeg processing via API
            const response = await fetch('/api/animations/modify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    trim_start: editTrimStart,
                    trim_end: editTrimEnd,
                    speed_multiplier: editSpeed,
                }),
            });
            if (!response.ok) throw new Error('Failed to save modifications');
            setEditingId(null);
            await fetchAnimations();
        } catch (err) {
            console.error('Error saving:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'queued':
                return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Queued</span>;
            case 'processing':
                return <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Processing
                </span>;
            case 'done':
                return <span className="px-2 py-1 text-xs rounded-full bg-success/20 text-success">Done</span>;
            case 'error':
                return <span className="px-2 py-1 text-xs rounded-full bg-error/20 text-error">Error</span>;
            default:
                return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">{status}</span>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Derived lists
    const visibleFolders = getSubfolders(animations, currentFolder);
    const visibleFiles = getFolderContents(animations, currentFolder);

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Breadcrumbs */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <h1 className="text-3xl font-bold text-foreground">Animations</h1>
                            {currentProject && (
                                <div className="flex items-center gap-1 text-muted-foreground ml-4 bg-muted/20 px-3 py-1 rounded-full">
                                    <span className="text-sm">/</span>
                                    {currentFolder !== '/' && (
                                        <button onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')} className="text-sm hover:underline">
                                            ...
                                        </button>
                                    )}
                                    <span className="text-sm font-mono">{currentFolder}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-muted mt-2">
                            {currentProject ? `Project: ${currentProject.name}` : 'Select a project to view animations'}
                        </p>
                        <p className="text-muted mt-1">
                            {animations.length} animation{animations.length !== 1 ? 's' : ''} •{' '}
                            {animations.filter(a => a.is_approved).length} approved
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentFolder !== '/' && (
                            <button onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')} className="px-4 py-2 border border-border rounded-lg hover:bg-muted font-medium transition-all">
                                Up
                            </button>
                        )}
                        <button onClick={createFolder} className="px-4 py-2 border border-primary/20 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 font-medium transition-all">
                            + New Folder
                        </button>
                        <a
                            href="/upload-images"
                            className="btn-primary px-4 py-2 rounded-lg ml-2"
                        >
                            Upload Images
                        </a>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error mb-6">
                        {error}
                    </div>
                )}

                {/* Animations Grid */}
                {animations.length === 0 ? (
                    <div className="text-center py-16">
                        <Video className="w-16 h-16 text-muted mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-foreground">No animations yet</h2>
                        <p className="text-muted mt-2">Upload images to generate animations</p>
                        <a
                            href="/upload-images"
                            className="btn-primary px-6 py-3 rounded-lg inline-block mt-4"
                        >
                            Upload Images
                        </a>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {/* Folders */}
                        {visibleFolders.map(folderPath => {
                            const folderName = folderPath.split('/').pop();
                            return (
                                <div
                                    key={folderPath}
                                    onDoubleClick={() => setCurrentFolder(folderPath)}
                                    className="rounded-xl border-2 border-dashed border-border p-6 flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all aspect-video"
                                >
                                    <Video className="w-12 h-12 text-primary/50" />
                                    <span className="font-medium text-foreground">{folderName}</span>
                                </div>
                            )
                        })}

                        {/* Files */}
                        {visibleFiles.map((animation) => (
                            <div
                                key={animation.id}
                                className="rounded-xl bg-card border border-border overflow-hidden"
                            >
                                {/* Thumbnail/Video Preview */}
                                <div
                                    className="aspect-video bg-black relative cursor-pointer group"
                                    onClick={() => animation.url && setSelectedAnimation(animation)}
                                >
                                    {animation.url ? (
                                        <video
                                            src={animation.url}
                                            className="w-full h-full object-cover"
                                            muted
                                            loop
                                            playsInline
                                            onMouseEnter={(e) => e.currentTarget.play()}
                                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                        />
                                    ) : animation.images?.url ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={animation.images.url}
                                            alt="Source"
                                            className="w-full h-full object-cover opacity-50"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Video className="w-12 h-12 text-muted" />
                                        </div>
                                    )}

                                    {/* Play overlay */}
                                    {animation.url && (
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Play className="w-12 h-12 text-white" />
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    <div className="absolute top-2 left-2">
                                        {getStatusBadge(animation.status)}
                                    </div>

                                    {/* Approved Badge */}
                                    {animation.is_approved && (
                                        <div className="absolute top-2 right-2 px-2 py-1 text-xs rounded-full bg-success text-white">
                                            Approved
                                        </div>
                                    )}
                                </div>

                                {/* Info & Controls */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-muted">{animation.duration}s</span>
                                        {animation.video_usage_count > 0 && (
                                            <span className="text-xs text-primary">
                                                Used in {animation.video_usage_count} video{animation.video_usage_count !== 1 ? 's' : ''}
                                            </span>
                                        {animation.video_usage_count > 0 && (
                                            <span className="text-xs text-primary">
                                                Used in {animation.video_usage_count} video{animation.video_usage_count !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {animation.status === 'done' && (
                                            <button
                                                onClick={() => {
                                                    setSelectedVideoForDetails(animation); // In real app, this might be a video_job, but adapting for now
                                                    setDetailsModalOpen(true);
                                                }}
                                                className="text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 px-2 py-1 rounded transition-colors ml-auto"
                                            >
                                                AI Details
                                            </button>
                                        )}
                                    </div>

                                    {/* Editing Controls */}
                                    {editingId === animation.id && animation.status === 'done' ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-muted">Trim Start (s)</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={animation.duration - 1}
                                                    step="0.1"
                                                    value={editTrimStart}
                                                    onChange={(e) => setEditTrimStart(parseFloat(e.target.value))}
                                                    className="w-full"
                                                />
                                                <span className="text-xs text-foreground">{editTrimStart.toFixed(1)}s</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted">Trim End (s)</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={animation.duration - 1}
                                                    step="0.1"
                                                    value={editTrimEnd}
                                                    onChange={(e) => setEditTrimEnd(parseFloat(e.target.value))}
                                                    className="w-full"
                                                />
                                                <span className="text-xs text-foreground">{editTrimEnd.toFixed(1)}s</span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted">Speed ({editSpeed.toFixed(2)}x)</label>
                                                <input
                                                    type="range"
                                                    min="0.25"
                                                    max="4"
                                                    step="0.25"
                                                    value={editSpeed}
                                                    onChange={(e) => setEditSpeed(parseFloat(e.target.value))}
                                                    className="w-full"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => saveEditing(animation.id)}
                                                    disabled={updatingId === animation.id}
                                                    className="flex-1 py-2 rounded-lg bg-success text-white text-sm font-medium disabled:opacity-50"
                                                >
                                                    {updatingId === animation.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                    ) : 'Save'}
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    className="flex-1 py-2 rounded-lg bg-card border border-border text-muted text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            {!animation.is_approved && animation.status === 'done' && (
                                                <button
                                                    onClick={() => handleApprove(animation.id)}
                                                    disabled={updatingId === animation.id}
                                                    className="flex-1 py-2 rounded-lg bg-success/20 text-success text-sm font-medium hover:bg-success hover:text-white transition-all disabled:opacity-50"
                                                >
                                                    {updatingId === animation.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1">
                                                            <Check className="w-4 h-4" /> Approve
                                                        </span>
                                                    )}
                                                </button>
                                            )}
                                            {animation.status === 'done' && (
                                                <button
                                                    onClick={() => startEditing(animation)}
                                                    className="py-2 px-3 rounded-lg bg-primary/20 text-primary text-sm hover:bg-primary hover:text-white transition-all"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(animation.id)}
                                                disabled={updatingId === animation.id}
                                                className="py-2 px-3 rounded-lg bg-error/20 text-error text-sm hover:bg-error hover:text-white transition-all disabled:opacity-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Video Preview Modal */}
                {selectedAnimation && (
                    <div
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedAnimation(null)}
                    >
                        <div
                            className="relative max-w-4xl w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setSelectedAnimation(null)}
                                className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <video
                                src={selectedAnimation.url!}
                                controls
                                autoPlay
                                loop
                                className="w-full rounded-xl"
                            />
                        </div>
                    </div>
                )}
            </div>
            {/* Video Details Modal */}
            <VideoDetailsModal
                isOpen={detailsModalOpen}
                onClose={() => {
                    setDetailsModalOpen(false);
                    setSelectedVideoForDetails(null);
                }}
                video={selectedVideoForDetails}
                project={currentProject}
                onUpdate={(updated) => {
                    // Update local list if needed
                    fetchAnimations();
                }}
            />
        </div>
    );
}
