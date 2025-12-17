'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, Trash2, Loader2, Video, AlertCircle, ChevronDown, ChevronUp, Play, X } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

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
}

export default function AnimationsPage() {
    const [animations, setAnimations] = useState<Animation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAnimation, setSelectedAnimation] = useState<Animation | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Edit state
    const [editTrimStart, setEditTrimStart] = useState(0);
    const [editTrimEnd, setEditTrimEnd] = useState(0);
    const [editSpeed, setEditSpeed] = useState(1);
    const { currentProject } = useProject();

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
    }, []);

    useEffect(() => {
        if (currentProject) {
            fetchAnimations();
            // Poll for updates every 10 seconds
            const interval = setInterval(fetchAnimations, 10000);
            return () => clearInterval(interval);
        } else {
            setAnimations([]);
            setLoading(false);
        }
    }, [fetchAnimations, currentProject]);

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

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Animations</h1>
                        <p className="text-muted mt-2">
                            {currentProject ? `Project: ${currentProject.name}` : 'Select a project to view animations'}
                        </p>
                        <p className="text-muted mt-1">
                            {animations.length} animation{animations.length !== 1 ? 's' : ''} •{' '}
                            {animations.filter(a => a.is_approved).length} approved
                        </p>
                    </div>
                    <a
                        href="/upload-images"
                        className="btn-primary px-4 py-2 rounded-lg"
                    >
                        Upload Images
                    </a>
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
                        {animations.map((animation) => (
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
        </div>
    );
}
