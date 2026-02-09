'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, Trash2, Loader2, Video, AlertCircle, ChevronDown, ChevronUp, Play, X, FolderOpen, Edit2, RotateCcw, Sparkles } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { VideoDetailsModal } from '@/components/VideoDetailsModal';
import { MoveAssetModal } from '@/components/MoveAssetModal';

interface Animation {
    id: string;
    image_id: string;
    url: string | null;
    thumbnail_url: string | null;
    duration: number;
    status: string;
    is_approved: boolean;
    error_message: string | null;
    prompt: string | null;
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
    progress?: number;
}

export default function AnimationsPage() {
    const [animations, setAnimations] = useState<Animation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAnimation, setSelectedAnimation] = useState<Animation | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [reanimatingId, setReanimatingId] = useState<string | null>(null);
    const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);

    // Reanimate Modal State
    const [reanimateModal, setReanimateModal] = useState<{ isOpen: boolean; animation: Animation | null; prompt: string; generating: boolean }>(
        { isOpen: false, animation: null, prompt: '', generating: false }
    );

    // Modal State
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedVideoForDetails, setSelectedVideoForDetails] = useState<any>(null);
    const [moveModalState, setMoveModalState] = useState<{ isOpen: boolean; itemId: string | null }>({ isOpen: false, itemId: null });

    // Edit state
    const [editTrimStart, setEditTrimStart] = useState(0);
    const [editTrimEnd, setEditTrimEnd] = useState(0);
    const [editSpeed, setEditSpeed] = useState(1);

    // Folder State
    const [currentFolder, setCurrentFolder] = useState<string>('/');
    const [projectFolders, setProjectFolders] = useState<any[]>([]);

    // Drag & Drop State
    const [draggedAnimationId, setDraggedAnimationId] = useState<string | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

    // Bulk Selection State
    const [selectedAnimIds, setSelectedAnimIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const { currentProject } = useProject();

    // ... fetchAnimations ...
    const fetchAnimations = useCallback(async () => {
        if (!currentProject) return;
        try {
            // Add timestamp to prevent browser caching of the polling request
            const response = await fetch(`/api/animations?projectId=${currentProject.id}&t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
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

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedAnimIds.size} animations?`)) return;

        const idsToDelete = Array.from(selectedAnimIds);
        setIsSelectionMode(false);

        // Optimistic update
        const remainingAnims = animations.filter(a => !selectedAnimIds.has(a.id));
        setAnimations(remainingAnims);
        setSelectedAnimIds(new Set());

        let errors = 0;
        for (const id of idsToDelete) {
            try {
                const res = await fetch(`/api/animations?id=${id}`, { method: 'DELETE' });
                if (!res.ok) errors++;
            } catch (e) {
                console.error("Failed to delete", id, e);
                errors++;
            }
        }

        if (errors > 0) {
            alert(`Failed to delete ${errors} animations.`);
            fetchAnimations();
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedAnimIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedAnimIds(next);
    };

    const toggleSelectAll = (filesInView: Animation[]) => {
        if (selectedAnimIds.size === filesInView.length) {
            setSelectedAnimIds(new Set());
        } else {
            setSelectedAnimIds(new Set(filesInView.map(f => f.id)));
        }
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

    const deleteFolder = async (e: React.MouseEvent, folderPath: string) => {
        e.stopPropagation();
        const folder = projectFolders.find(f => f.path === folderPath);
        if (!folder) return;

        const count = animations.filter(a => {
            const f = (a as any).folder || '/';
            return f === folderPath || f.startsWith(folderPath + '/');
        }).length;

        if (!confirm(`Delete folder "${folderPath.split('/').pop()}"?${count > 0 ? ` ${count} item(s) will be moved to root.` : ''}`)) return;

        try {
            const response = await fetch(`/api/folders?id=${folder.id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchFolders();
                await fetchAnimations();
                if (currentFolder.startsWith(folderPath)) setCurrentFolder('/');
            } else {
                throw new Error('Failed to delete folder');
            }
        } catch (e) {
            alert('Failed to delete folder');
        }
    };

    const renameFolder = async (e: React.MouseEvent, folderPath: string) => {
        e.stopPropagation();
        const folder = projectFolders.find(f => f.path === folderPath);
        if (!folder) return;

        const currentName = folderPath.split('/').pop() || '';
        const newName = prompt('New folder name:', currentName);
        if (!newName || newName === currentName) return;

        try {
            const response = await fetch('/api/folders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: folder.id, new_name: newName })
            });

            if (response.ok) {
                const data = await response.json();
                await fetchFolders();
                await fetchAnimations();
                if (currentFolder === folderPath) setCurrentFolder(data.path);
            } else {
                const errData = await response.json();
                alert(errData.error || 'Failed to rename folder');
            }
        } catch (e) {
            alert('Failed to rename folder');
        }
    };

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

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
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

    const openReanimateModal = (animation: Animation) => {
        if (!animation.images?.url) {
            alert('No source image found for this animation.');
            return;
        }
        setReanimateModal({
            isOpen: true,
            animation,
            prompt: animation.prompt || '',
            generating: false,
        });
    };

    const generatePromptForReanimate = async () => {
        if (!reanimateModal.animation?.images?.url) return;
        setReanimateModal(prev => ({ ...prev, generating: true }));
        try {
            const res = await fetch('/api/animations/generate-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: reanimateModal.animation.images.url }),
            });
            if (!res.ok) throw new Error('Failed to generate prompt');
            const data = await res.json();
            setReanimateModal(prev => ({ ...prev, prompt: data.prompt, generating: false }));
        } catch (err) {
            console.error('Error generating prompt:', err);
            alert('Failed to generate prompt.');
            setReanimateModal(prev => ({ ...prev, generating: false }));
        }
    };

    const handleReanimateSubmit = async () => {
        const animation = reanimateModal.animation;
        if (!animation?.images?.url) return;

        setReanimateModal(prev => ({ ...prev, isOpen: false }));
        setReanimatingId(animation.id);
        try {
            // Reset status to processing
            const resetRes = await fetch('/api/animations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: animation.id,
                    status: 'processing',
                    error_message: null,
                }),
            });
            if (!resetRes.ok) throw new Error('Failed to reset animation status');

            // Trigger generation with the user's prompt
            fetch('/api/animations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    animation_id: animation.id,
                    image_url: animation.images.url,
                    duration: animation.duration,
                    prompt: reanimateModal.prompt,
                }),
            }).catch(err => console.error('Reanimate request failed:', err));

            // Update UI optimistically
            setAnimations(prev =>
                prev.map(a =>
                    a.id === animation.id
                        ? { ...a, status: 'processing', error_message: null }
                        : a
                )
            );
        } catch (err) {
            console.error('Error reanimating:', err);
            alert('Failed to start reanimation.');
        } finally {
            setReanimatingId(null);
        }
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

    const getStatusBadge = (status: string, progress?: number) => {
        switch (status) {
            case 'queued':
                return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Queued</span>;
            case 'processing':
                return <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> {progress ? `Processing ${progress}%` : 'Processing'}
                </span>;
            case 'done':
                return <span className="px-2 py-1 text-xs rounded-full bg-success/20 text-success">Done</span>;
            case 'error':
                return <span className="px-2 py-1 text-xs rounded-full bg-error/20 text-error">Error</span>;
            default:
                return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">{status}</span>;
        }
    };

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedAnimationId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Create a custom drag image if needed, or stick to browser default
    };

    const handleDragOver = (e: React.DragEvent, folderPath: string) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolder(folderPath);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // e.preventDefault(); 
        // We might want to clear dragOverFolder here, but careful about flickering
        // when moving over child elements. Usually better to clear on drop or dragend.
        // setDragOverFolder(null); 
    };

    const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
        e.preventDefault();
        setDragOverFolder(null);

        if (!draggedAnimationId) return;

        // Optimistic UI update or wait for API? Let's wait for API but show loading?
        // Actually, let's just do it.
        try {
            const res = await fetch('/api/animations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: draggedAnimationId,
                    folder: targetFolder
                })
            });

            if (res.ok) {
                await fetchAnimations(); // Refresh list
            } else {
                console.error("Failed to move item");
                const data = await res.json();
                alert(data.error || 'Failed to move');
            }
        } catch (err) {
            console.error("Drop error", err);
        } finally {
            setDraggedAnimationId(null);
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
        <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-purple-500/30">
            {/* Background Gradients - consistent with mpage */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] mix-blend-screen" />
                <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-zinc-500/5 rounded-full blur-[120px] mix-blend-screen" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Breadcrumbs */}
                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Animations
                            </h1>
                            {currentProject && (
                                <div className="flex items-center gap-2 text-gray-400 ml-2 px-3 py-1 rounded-full border border-white/5 bg-white/5 backdrop-blur-sm">
                                    <span className="text-xs">/</span>
                                    {currentFolder !== '/' && (
                                        <button
                                            onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                            onDragOver={(e) => handleDragOver(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                            onDrop={(e) => handleDrop(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                            className="text-sm hover:text-white transition-colors flex items-center gap-1 p-1 rounded hover:bg-white/10"
                                            title="Drop to move up"
                                        >
                                            <ChevronUp className="w-3 h-3" /> ...
                                        </button>
                                    )}
                                    <span className="text-sm font-mono text-gray-200">{currentFolder}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-gray-400 text-sm">
                            {currentProject ? `Project: ${currentProject.name}` : 'Select a project'} • {animations.length} items
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {isSelectionMode ? (
                            <>
                                <span className="text-sm text-gray-400 mr-2">{selectedAnimIds.size} selected</span>
                                <button
                                    onClick={() => toggleSelectAll(visibleFiles)}
                                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                                >
                                    {selectedAnimIds.size === visibleFiles.length ? 'Deselect All' : 'Select All'}
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={selectedAnimIds.size === 0}
                                    className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 rounded-xl disabled:opacity-50 transition-all"
                                >
                                    Delete Selected
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSelectionMode(false);
                                        setSelectedAnimIds(new Set());
                                    }}
                                    className="px-3 py-1.5 text-xs hover:bg-white/10 rounded-xl text-gray-300 transition-all"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsSelectionMode(true)}
                                    className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-2 text-gray-300 transition-all"
                                >
                                    <span className="w-4 h-4 border border-current rounded-sm"></span>
                                    Select Multiple
                                </button>
                                {currentFolder !== '/' && (
                                    <button
                                        onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                        onDragOver={(e) => handleDragOver(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                        onDrop={(e) => handleDrop(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                        className={`px-4 py-2 border rounded-xl bg-transparent transition-all text-sm font-medium text-gray-300 flex items-center gap-2
                                            ${dragOverFolder === (currentFolder.split('/').slice(0, -1).join('/') || '/') ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 hover:bg-white/5'}
                                        `}
                                    >
                                        <ChevronUp className="w-4 h-4" /> Up
                                    </button>
                                )}
                                <button onClick={createFolder} className="px-4 py-2 border border-white/10 bg-white/5 text-white rounded-xl hover:bg-white/10 text-sm font-medium transition-all">
                                    New Folder
                                </button>
                                <a
                                    href="/upload-images"
                                    className="px-5 py-2 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 transition-all hover:scale-105 flex items-center gap-2"
                                >
                                    <Video className="w-4 h-4" /> Upload
                                </a>
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-8 backdrop-blur-sm">
                        <AlertCircle className="w-5 h-5 inline mr-2" />
                        {error}
                    </div>
                )}

                {/* Animations Grid */}
                {animations.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/5">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Video className="w-10 h-10 text-gray-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">No animations yet</h2>
                        <p className="text-gray-400 max-w-md mx-auto mb-8">
                            Upload images to generate stunning animations for your music videos.
                        </p>
                        <a
                            href="/upload-images"
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                        >
                            Get Started
                        </a>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {/* Folders */}
                        {visibleFolders.map(folderPath => {
                            const folderName = folderPath.split('/').pop();
                            // Calculate count
                            const count = animations.filter(a => {
                                const f = (a as any).folder || '/';
                                return f === folderPath || f.startsWith(folderPath + '/');
                            }).length;

                            const isDragOver = dragOverFolder === folderPath;

                            return (
                                <div
                                    key={folderPath}
                                    onDoubleClick={() => setCurrentFolder(folderPath)}
                                    // Drag Handlers for Folder (Drop Zone)
                                    onDragOver={(e) => handleDragOver(e, folderPath)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, folderPath)}
                                    className={`group relative rounded-2xl border bg-white/[0.02] p-6 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all aspect-video backdrop-blur-sm
                                        ${isDragOver
                                            ? 'border-primary bg-primary/20 scale-105 shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]'
                                            : 'border-white/10 hover:bg-white/[0.05] hover:border-white/20 hover:shadow-lg'
                                        }
                                    `}
                                >
                                    <div className={`p-4 rounded-full transition-all duration-300 ${isDragOver ? 'bg-primary text-black' : 'bg-white/5 text-gray-400 group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white'}`}>
                                        {isDragOver ? <FolderOpen className="w-8 h-8 animate-bounce" /> : <ChevronDown className="w-8 h-8" />}
                                    </div>
                                    <div className="text-center">
                                        <span className={`block font-medium tracking-wide ${isDragOver ? 'text-primary' : 'text-gray-200'}`}>{folderName}</span>
                                        <span className="text-xs text-gray-500 mt-1">{count} item{count !== 1 ? 's' : ''}</span>
                                    </div>

                                    {/* Folder Actions */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => renameFolder(e, folderPath)}
                                            className="p-1.5 rounded-lg bg-black/50 hover:bg-white/20 text-gray-400 hover:text-white backdrop-blur-sm transition-all"
                                            title="Rename folder"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => deleteFolder(e, folderPath)}
                                            className="p-1.5 rounded-lg bg-black/50 hover:bg-red-500/30 text-gray-400 hover:text-red-400 backdrop-blur-sm transition-all"
                                            title="Delete folder"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {isDragOver && (
                                        <div className="absolute inset-x-0 bottom-4 text-center text-xs font-bold text-primary animate-pulse">
                                            DROP TO MOVE HERE
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Files */}
                        {visibleFiles.map((animation) => (
                            <div
                                key={animation.id}
                                // Draggable Attributes
                                draggable={!isSelectionMode && editingId !== animation.id}
                                onDragStart={(e) => {
                                    if (isSelectionMode || editingId === animation.id) {
                                        e.preventDefault();
                                        return;
                                    }
                                    handleDragStart(e, animation.id);
                                }}
                                onClick={() => isSelectionMode && toggleSelection(animation.id)}
                                className={`group relative rounded-2xl border border-white/10 bg-[#121212] overflow-hidden hover:border-white/20 hover:shadow-2xl transition-all duration-300
                                    ${draggedAnimationId === animation.id ? 'opacity-50 border-primary border-dashed scale-95' : ''}
                                    ${isSelectionMode && selectedAnimIds.has(animation.id) ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}
                                    ${isSelectionMode ? 'cursor-pointer' : ''}
                                `}
                            >
                                {isSelectionMode && (
                                    <div className="absolute top-3 left-3 z-50">
                                        <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors shadow-lg ${selectedAnimIds.has(animation.id) ? 'bg-primary border-primary' : 'bg-black/40 border-white/50 backdrop-blur-md'}`}>
                                            {selectedAnimIds.has(animation.id) && <Check className="w-4 h-4 text-black" />}
                                        </div>
                                    </div>
                                )}
                                {/* Thumbnail/Video Preview */}
                                <div
                                    className="aspect-video bg-black relative cursor-pointer overflow-hidden"
                                    onClick={() => !isSelectionMode && animation.url && setSelectedAnimation(animation)}
                                >
                                    {animation.url ? (
                                        <video
                                            id={`preview-video-${animation.id}`}
                                            src={animation.url}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                            muted
                                            loop
                                            playsInline
                                            // FIX: Added poster for visibility before loading
                                            poster={animation.thumbnail_url || animation.images?.url || undefined}
                                            onMouseEnter={(e) => e.currentTarget.play()}
                                            // FIX: Respect trim boundaries during preview
                                            onTimeUpdate={(e) => {
                                                if (editingId === animation.id) {
                                                    const vid = e.currentTarget;
                                                    if (vid.currentTime < editTrimStart || vid.currentTime > editTrimEnd) {
                                                        vid.currentTime = editTrimStart;
                                                    }
                                                }
                                            }}
                                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = editTrimStart || 0; }}
                                        />
                                    ) : animation.images?.url ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={animation.images.url}
                                            alt="Source"
                                            className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                                            <Video className="w-12 h-12 text-white/20" />
                                        </div>
                                    )}

                                    {/* Play overlay */}
                                    {animation.url && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                                                <Play className="w-5 h-5 text-white ml-1" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    <div className={`absolute top-3 left-3 ${isSelectionMode ? 'opacity-0 pointer-events-none' : ''}`}>
                                        {getStatusBadge(animation.status, animation.progress)}
                                    </div>

                                    {/* Approved Badge */}
                                    {animation.is_approved && (
                                        <div className="absolute top-3 right-3 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-green-500/20 text-green-400 border border-green-500/30 backdrop-blur-md">
                                            Approved
                                        </div>
                                    )}
                                </div>

                                {/* Info & Controls */}
                                <div className="p-4 bg-white/[0.02]">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-mono text-gray-500">ID: {animation.id.slice(0, 4)}</span>
                                            <span className="text-sm font-medium text-gray-300">{Number(animation.duration).toFixed(1)}s</span>
                                        </div>

                                        {animation.video_usage_count > 0 && (
                                            <span className="text-xs px-2 py-1 rounded-md bg-white/10 text-white border border-white/20">
                                                {animation.video_usage_count} uses
                                            </span>
                                        )}
                                    </div>

                                    {/* Prompt Display */}
                                    {animation.prompt && (
                                        <div className="mb-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedPromptId(expandedPromptId === animation.id ? null : animation.id);
                                                }}
                                                className="w-full text-left group/prompt"
                                            >
                                                <p className={`text-xs text-gray-400 leading-relaxed ${expandedPromptId === animation.id ? '' : 'line-clamp-2'
                                                    }`}>
                                                    <span className="text-gray-500 font-medium">Prompt: </span>
                                                    {animation.prompt}
                                                </p>
                                                {animation.prompt.length > 80 && (
                                                    <span className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors mt-0.5 inline-block">
                                                        {expandedPromptId === animation.id ? '▲ less' : '▼ more'}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {animation.error_message && (
                                        <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <p className="text-xs text-red-400 line-clamp-2">
                                                {animation.error_message}
                                            </p>
                                        </div>
                                    )}

                                    {/* Editing Controls */}
                                    {editingId === animation.id && animation.status === 'done' ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="space-y-3 p-3 rounded-xl bg-white/5 border border-white/10"
                                                // STOP DRAG for the entire controls container just in case
                                                draggable={false}
                                                onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span>Start</span>
                                                        <span>{editTrimStart.toFixed(1)}s</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={animation.duration - 1}
                                                        step="0.1"
                                                        value={editTrimStart}
                                                        draggable={false}
                                                        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setEditTrimStart(val);
                                                            // Find video element and seek
                                                            const vid = document.getElementById(`preview-video-${animation.id}`) as HTMLVideoElement;
                                                            if (vid) {
                                                                vid.currentTime = val;
                                                                if (vid.paused) vid.play(); // Briefly play to show frame? Or just seek.
                                                            }
                                                        }}
                                                        className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span>End</span>
                                                        <span>{editTrimEnd.toFixed(1)}s</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={animation.duration - 1}
                                                        step="0.1"
                                                        value={editTrimEnd}
                                                        draggable={false}
                                                        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        onChange={(e) => setEditTrimEnd(parseFloat(e.target.value))}
                                                        className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span>Speed Multiplier</span>
                                                        <span>{editSpeed.toFixed(2)}x</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0.25"
                                                        max="4"
                                                        step="0.05"
                                                        value={editSpeed}
                                                        draggable={false}
                                                        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setEditSpeed(val);
                                                            const vid = document.getElementById(`preview-video-${animation.id}`) as HTMLVideoElement;
                                                            if (vid) vid.playbackRate = val;
                                                        }}
                                                        className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => saveEditing(animation.id)}
                                                    disabled={updatingId === animation.id}
                                                    className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors shadow-lg shadow-green-900/20"
                                                >
                                                    {updatingId === animation.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'SAVE'}
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
                                                >
                                                    CANCEL
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {!animation.is_approved && animation.status === 'done' && (
                                                <button
                                                    onClick={() => handleApprove(animation.id)}
                                                    disabled={updatingId === animation.id}
                                                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 border border-white/5 hover:border-green-500/30 transition-all text-xs font-medium"
                                                >
                                                    {updatingId === animation.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Approve'}
                                                </button>
                                            )}

                                            {animation.status === 'done' && (
                                                <button
                                                    onClick={() => startEditing(animation)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                                    title="Edit"
                                                >
                                                    <span className="text-xs font-medium">Edit</span>
                                                </button>
                                            )}

                                            {/* Reanimate Button */}
                                            {animation.images?.url && (animation.status === 'done' || animation.status === 'error') && (
                                                <button
                                                    onClick={() => openReanimateModal(animation)}
                                                    disabled={reanimatingId === animation.id}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center gap-1"
                                                    title="Reanimate"
                                                >
                                                    {reanimatingId === animation.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    )}
                                                    <span className="text-xs font-medium">Reanimate</span>
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setMoveModalState({ isOpen: true, itemId: animation.id })}
                                                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                                title="Move Folder"
                                            >
                                                <span className="text-xs font-medium">Move</span>
                                            </button>

                                            <button
                                                onClick={(e) => handleDelete(e, animation.id)}
                                                disabled={updatingId === animation.id}
                                                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                                                title="Delete"
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
                        className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setSelectedAnimation(null)}
                    >
                        <div
                            className="relative max-w-5xl w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setSelectedAnimation(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 text-white hover:text-red-400 rounded-full backdrop-blur-md z-10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <video
                                src={selectedAnimation.url!}
                                controls
                                autoPlay
                                loop
                                className="w-full h-auto max-h-[80vh]"
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
                    fetchAnimations();
                }}
            />

            <MoveAssetModal
                isOpen={moveModalState.isOpen}
                onClose={() => setMoveModalState({ isOpen: false, itemId: null })}
                currentFolder={currentFolder}
                assetType="animation"
                onMove={async (targetFolder) => {
                    if (moveModalState.itemId) {
                        try {
                            const res = await fetch('/api/animations', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    id: moveModalState.itemId,
                                    folder: targetFolder
                                })
                            });

                            if (res.ok) {
                                await fetchAnimations();
                            } else {
                                const data = await res.json();
                                alert(data.error || 'Failed to move animation');
                            }
                        } catch (err) {
                            console.error('Failed to move animation', err);
                            alert('Failed to move animation');
                        }
                    }
                }}
            />

            {/* Reanimate Prompt Modal */}
            {reanimateModal.isOpen && reanimateModal.animation && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-start justify-center p-4 pt-20 animate-in fade-in duration-200"
                    onClick={() => setReanimateModal({ isOpen: false, animation: null, prompt: '', generating: false })}
                >
                    <div
                        className="relative w-full max-w-lg bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-purple-400" />
                                Reanimate
                            </h3>
                            <button
                                onClick={() => setReanimateModal({ isOpen: false, animation: null, prompt: '', generating: false })}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Image Preview */}
                        {reanimateModal.animation.images?.url && (
                            <div className="px-4 pt-4">
                                <img
                                    src={reanimateModal.animation.images.url}
                                    alt="Source image"
                                    className="w-full h-40 object-cover rounded-lg border border-white/10"
                                />
                            </div>
                        )}

                        {/* Prompt Input */}
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-300">Animation Prompt</label>
                                <button
                                    onClick={generatePromptForReanimate}
                                    disabled={reanimateModal.generating}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 border border-purple-500/20 text-xs font-medium transition-all disabled:opacity-50"
                                >
                                    {reanimateModal.generating ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-3.5 h-3.5" />
                                    )}
                                    {reanimateModal.generating ? 'Generating...' : 'AI Generate'}
                                </button>
                            </div>
                            <textarea
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                                placeholder="Describe how you want this image to be animated..."
                                rows={4}
                                value={reanimateModal.prompt}
                                onChange={(e) => setReanimateModal(prev => ({ ...prev, prompt: e.target.value }))}
                            />
                            <p className="text-xs text-gray-500">
                                Edit the prompt above or click &quot;AI Generate&quot; to create one from the image.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 p-4 border-t border-white/10 bg-white/[0.02]">
                            <button
                                onClick={() => setReanimateModal({ isOpen: false, animation: null, prompt: '', generating: false })}
                                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReanimateSubmit}
                                disabled={!reanimateModal.prompt.trim()}
                                className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reanimate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

