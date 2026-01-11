'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Music, Loader2, Trash2, Play, Pause, Clock, Folder, FolderOpen, Edit2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useProject } from '@/context/ProjectContext';
import { MoveAssetModal } from '@/components/MoveAssetModal';

interface MusicTrack {
    id: string;
    url: string;
    filename: string;
    file_size: number | null;
    duration_seconds: number | null;
    video_usage_count: number;
    created_at: string;
}

export default function MusicLibraryPage() {
    const [music, setMusic] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [moveModalState, setMoveModalState] = useState<{ isOpen: boolean; itemId: string | null }>({ isOpen: false, itemId: null });
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Folder State
    const [currentFolder, setCurrentFolder] = useState<string>('/');
    const [projectFolders, setProjectFolders] = useState<any[]>([]);

    // Drag & Drop State
    const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

    // Bulk Selection State
    const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const { currentProject } = useProject();

    // ... (fetchMusic same as before) ...
    const fetchMusic = useCallback(async () => {
        if (!currentProject) return;

        try {
            const response = await fetch(`/api/music?projectId=${currentProject.id}`);
            if (!response.ok) throw new Error('Failed to fetch music');
            const data = await response.json();
            setMusic(data);
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
                // If API fails, try to parse error message
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error || 'Failed to fetch folders';
                console.error("Folder Fetch Error:", errMsg);
                // Do not block main UI, but maybe show a toast or small error?
                // For debugging, let's set it to main error if it's a critical config issue
                if (errMsg.includes('Configuration Error') || errMsg.includes('Service Role')) {
                    setError(errMsg);
                }
            }
        } catch (err) {
            console.error('Failed to fetch folders', err);
            setError(`Folder Load Error: ${(err as Error).message}`);
        }
    }, [currentProject]);

    useEffect(() => {
        if (currentProject) {
            fetchMusic();
            fetchFolders();
        } else {
            setMusic([]);
            setLoading(false);
        }
    }, [fetchMusic, fetchFolders, currentProject]);

    // Folder Helpers
    const getFolderContents = (items: MusicTrack[], folder: string) => {
        return items.filter(i => ((i as any).folder || '/') === folder);
    };

    const getSubfolders = (items: MusicTrack[], currentPath: string) => {
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

        // 2. From Files ( Virtual )
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
        if (!confirm(`Are you sure you want to delete ${selectedTrackIds.size} tracks?`)) return;

        const idsToDelete = Array.from(selectedTrackIds);
        setIsSelectionMode(false);

        // Optimistic update
        const remainingMusic = music.filter(m => !selectedTrackIds.has(m.id));
        setMusic(remainingMusic);
        setSelectedTrackIds(new Set());

        let errors = 0;
        for (const id of idsToDelete) {
            try {
                const res = await fetch(`/api/music?id=${id}`, { method: 'DELETE' });
                if (!res.ok) errors++;
            } catch (e) {
                console.error("Failed to delete", id, e);
                errors++;
            }
        }

        if (errors > 0) {
            alert(`Failed to delete ${errors} tracks.`);
            fetchMusic(); // Refresh on error
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedTrackIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedTrackIds(next);
    };

    const toggleSelectAll = (filesInView: MusicTrack[]) => {
        if (selectedTrackIds.size === filesInView.length) {
            setSelectedTrackIds(new Set());
        } else {
            setSelectedTrackIds(new Set(filesInView.map(f => f.id)));
        }
    };

    const createFolder = async () => {
        const name = prompt('Folder Name:');
        if (!name) return;

        let newPath = currentFolder === '/' ? `/${name}` : `${currentFolder}/${name}`;
        if (!newPath.startsWith('/')) newPath = '/' + newPath;

        try {
            // 1. Save to DB (Unified)
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: currentProject?.id, path: newPath })
            });

            if (response.ok) {
                await fetchFolders(); // Updates list
                setCurrentFolder(newPath); // Enter it
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

        const count = music.filter(m => {
            const f = (m as any).folder || '/';
            return f === folderPath || f.startsWith(folderPath + '/');
        }).length;

        if (!confirm(`Delete folder "${folderPath.split('/').pop()}"?${count > 0 ? ` ${count} item(s) will be moved to root.` : ''}`)) return;

        try {
            const response = await fetch(`/api/folders?id=${folder.id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchFolders();
                await fetchMusic();
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
                await fetchMusic();
                if (currentFolder === folderPath) setCurrentFolder(data.path);
            } else {
                const errData = await response.json();
                alert(errData.error || 'Failed to rename folder');
            }
        } catch (e) {
            alert('Failed to rename folder');
        }
    };

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        if (files.length > 0) {
            uploadFiles(files);
        }
    }, [currentFolder, currentProject]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('audio/'));
        uploadFiles(files);
    }, [currentFolder, currentProject]);

    const uploadFiles = async (files: File[]) => {
        if (files.length === 0) return;
        if (!currentProject) {
            setError("Please select a project first");
            return;
        }

        setUploading(true);
        setError(null);
        const supabase = createClient();

        for (const file of files) {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                // HETZNER STORAGE MIGRATION
                const formData = new FormData();
                formData.append('type', 'music'); // /var/www/music (Must be before file)
                formData.append('file', file, fileName);

                const serverIp = process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244';
                const uploadEndpoint = `https://${serverIp}.nip.io/upload`;

                const uploadRes = await fetch(uploadEndpoint, {
                    method: 'POST',
                    body: formData
                });

                if (!uploadRes.ok) {
                    const errorText = await uploadRes.text();
                    throw new Error(`Upload Server Error: ${errorText}`);
                }

                const { url: publicUrl } = await uploadRes.json();

                let duration: number | null = null;
                try {
                    duration = await getAudioDuration(file);
                } catch (err) {
                    console.error('Error getting audio duration:', err);
                }

                const response = await fetch('/api/music', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: publicUrl,
                        filename: file.name,
                        file_size: file.size,
                        duration_seconds: duration,
                        project_id: currentProject.id,
                        folder: currentFolder, // Key Addition
                    }),
                });

                if (!response.ok) throw new Error('Failed to save music');

            } catch (err) {
                console.error('Error uploading music:', err);
                setError(`Failed to upload ${file.name}: ${(err as Error).message}`);
            }
        }

        setUploading(false);
        fetchMusic();
    };

    const getAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
            };
            audio.onerror = () => {
                reject(new Error('Failed to load audio'));
            };
            audio.src = URL.createObjectURL(file);
        });
    };

    const handleMove = async (id: string, newFolder: string) => {
        try {
            const response = await fetch('/api/music', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, folder: newFolder }),
            });
            if (!response.ok) throw new Error('Failed to move');
            await fetchMusic();
        } catch (err) {
            console.error('Error moving:', err);
            setError((err as Error).message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this music track?')) return;
        setDeletingId(id);
        try {
            const response = await fetch(`/api/music?id=${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete');
            await fetchMusic();
        } catch (err) {
            console.error('Error deleting:', err);
            setError((err as Error).message);
        } finally {
            setDeletingId(null);
        }
    };

    const togglePlay = (track: MusicTrack) => {
        if (playingId === track.id) {
            audioRef.current?.pause();
            setPlayingId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.src = track.url;
                audioRef.current.play();
            }
            setPlayingId(track.id);
        }
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '--';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    // --- Drag & Drop Handlers (Item Moving) ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTrackId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Explicitly set text/plain to avoid issues with some browsers/OS
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e: React.DragEvent, folderPath: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolder(folderPath);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // Optional: clear dragOverFolder if leaving the drop zone completely
    };

    const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
        e.preventDefault();
        setDragOverFolder(null);

        // Check if it's a file upload drop vs item move drop
        // If draggedTrackId is null, it might be a file upload, handled by container's onDrop
        if (!draggedTrackId) return;

        try {
            await handleMove(draggedTrackId, targetFolder);
        } catch (err) {
            // Error already handled in handleMove
        } finally {
            setDraggedTrackId(null);
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
    const visibleFolders = getSubfolders(music, currentFolder);
    const visibleFiles = getFolderContents(music, currentFolder);

    return (
        <div className="min-h-screen bg-background">
            <audio
                ref={audioRef}
                onEnded={() => setPlayingId(null)}
                className="hidden"
            />

            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Breadcrumbs */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <h1 className="text-3xl font-bold text-foreground">Music Library</h1>
                            {currentProject && (
                                <div className="flex items-center gap-1 text-muted-foreground ml-4 bg-muted/20 px-3 py-1 rounded-full">
                                    <span className="text-sm">/</span>
                                    {currentFolder !== '/' && (
                                        <button
                                            onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                            onDragOver={(e) => handleDragOver(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                            onDrop={(e) => handleDrop(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                            className="text-sm hover:underline"
                                        >
                                            ...
                                        </button>
                                    )}
                                    <span className="text-sm font-mono">{currentFolder}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-muted mt-2">
                            {currentProject ? `Project: ${currentProject.name}` : 'Select a project to manage music'}
                        </p>
                        <p className="text-muted mt-1">
                            {music.length} track{music.length !== 1 ? 's' : ''} in library
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {isSelectionMode ? (
                            <>
                                <span className="text-sm text-muted-foreground mr-2">{selectedTrackIds.size} selected</span>
                                <button
                                    onClick={() => toggleSelectAll(visibleFiles)}
                                    className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded"
                                >
                                    {selectedTrackIds.size === visibleFiles.length ? 'Deselect All' : 'Select All'}
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={selectedTrackIds.size === 0}
                                    className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 rounded disabled:opacity-50"
                                >
                                    Delete Selected
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSelectionMode(false);
                                        setSelectedTrackIds(new Set());
                                    }}
                                    className="px-3 py-1.5 text-xs hover:bg-white/10 rounded"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsSelectionMode(true)}
                                    className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded flex items-center gap-2"
                                >
                                    <span className="w-4 h-4 border border-current rounded-sm"></span>
                                    Select Multiple
                                </button>
                                {currentFolder !== '/' && (
                                    <button
                                        onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                        onDragOver={(e) => handleDragOver(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                        onDrop={(e) => handleDrop(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                        className={`px-4 py-2 border rounded-lg transition-all font-medium flex items-center gap-2
                                            ${dragOverFolder === (currentFolder.split('/').slice(0, -1).join('/') || '/') ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}
                                        `}
                                    >
                                        Up
                                    </button>
                                )}
                                <button onClick={createFolder} className="px-4 py-2 border border-primary/20 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 font-medium transition-all">
                                    + New Folder
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Drop Zone (File Upload) */}
                <div
                    className="mb-6 p-8 rounded-xl border-2 border-dashed border-border hover:border-primary transition-all cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById('music-input')?.click()}
                >
                    <input
                        id="music-input"
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                    />
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 rounded-full bg-primary/10">
                            {uploading ? (
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            ) : (
                                <Upload className="w-8 h-8 text-primary" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-foreground">
                                {uploading ? 'Uploading...' : `Upload to ${currentFolder === '/' ? 'Root' : currentFolder}`}
                            </p>
                            <p className="text-sm text-muted mt-1">Status: Ready</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error mb-6">
                        {error}
                    </div>
                )}

                {/* Music List */}
                {music.length === 0 ? (
                    <div className="text-center py-16">
                        <Music className="w-16 h-16 text-muted mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-foreground">No music yet</h2>
                        <p className="text-muted mt-2">Upload music files to get started</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Folders */}
                        {visibleFolders.map(folderPath => {
                            const folderName = folderPath.split('/').pop();
                            // Calculate count recursively
                            const count = music.filter(m => {
                                const f = (m as any).folder || '/';
                                return f === folderPath || f.startsWith(folderPath + '/');
                            }).length;

                            const isDragOver = dragOverFolder === folderPath;

                            return (
                                <div
                                    key={folderPath}
                                    onDoubleClick={() => setCurrentFolder(folderPath)}
                                    // Drag Handlers
                                    onDragOver={(e) => handleDragOver(e, folderPath)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, folderPath)}
                                    className={`group flex items-center gap-4 p-4 rounded-xl bg-card border cursor-pointer transition-all
                                        ${isDragOver
                                            ? 'border-primary bg-primary/10 scale-[1.01] shadow-lg'
                                            : 'border-border hover:border-primary/50'
                                        }
                                    `}
                                >
                                    <div className={`p-3 rounded-full ${isDragOver ? 'bg-primary text-black' : 'bg-primary/10 text-primary'}`}>
                                        {isDragOver ? <FolderOpen className="w-5 h-5 animate-pulse" /> : <Folder className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-medium ${isDragOver ? 'text-primary' : 'text-foreground'}`}>{folderName}</p>
                                        <p className="text-xs text-muted">{count} music file{count !== 1 ? 's' : ''}</p>
                                    </div>

                                    {/* Folder Actions */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => renameFolder(e, folderPath)}
                                            className="p-1.5 rounded-lg hover:bg-primary/20 text-muted hover:text-primary transition-all"
                                            title="Rename folder"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => deleteFolder(e, folderPath)}
                                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted hover:text-red-400 transition-all"
                                            title="Delete folder"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {isDragOver && (
                                        <div className="text-xs font-bold text-primary animate-pulse mr-4">
                                            DROP TO MOVE
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Files */}
                        {visibleFiles.map((track) => (
                            <div
                                key={track.id}
                                draggable={!isSelectionMode}
                                onDragStart={(e) => {
                                    if (!isSelectionMode) handleDragStart(e, track.id);
                                }}
                                onClick={() => {
                                    if (isSelectionMode) toggleSelection(track.id);
                                }}
                                className={`flex items-center gap-4 p-4 rounded-xl bg-card border transition-all cursor-pointer
                                    ${isSelectionMode && selectedTrackIds.has(track.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                                    ${!isSelectionMode && draggedTrackId === track.id ? 'opacity-50 border-primary border-dashed' : ''}
                                `}
                            >
                                {isSelectionMode && (
                                    <div className={`
                                        w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                                        ${selectedTrackIds.has(track.id) ? 'bg-primary border-primary' : 'bg-transparent border-muted-foreground'}
                                    `}>
                                        {selectedTrackIds.has(track.id) && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                                    </div>
                                )}
                                <button
                                    onClick={() => togglePlay(track)}
                                    className="p-3 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all"
                                >
                                    {playingId === track.id ? (
                                        <Pause className="w-5 h-5" />
                                    ) : (
                                        <Play className="w-5 h-5" />
                                    )}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{track.filename}</p>
                                    <div className="flex items-center gap-4 text-sm text-muted mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDuration(track.duration_seconds)}
                                        </span>
                                        <span>{formatFileSize(track.file_size)}</span>
                                        {track.video_usage_count > 0 && (
                                            <span className="text-primary">
                                                Used in {track.video_usage_count} video{track.video_usage_count !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {/* Move Button */}
                                        <button
                                            onClick={() => setMoveModalState({ isOpen: true, itemId: track.id })}
                                            className="text-xs bg-muted/50 hover:bg-muted px-2 py-1 rounded transition-colors"
                                        >
                                            Move
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(track.id)}
                                    disabled={deletingId === track.id}
                                    className="p-2 rounded-lg text-error hover:bg-error/10 transition-all disabled:opacity-50"
                                >
                                    {deletingId === track.id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        ))}

                        {visibleFolders.length === 0 && visibleFiles.length === 0 && (
                            <div className="text-center py-8 text-muted">
                                Empty folder
                            </div>
                        )}
                    </div>
                )}
            </div>

            <MoveAssetModal
                isOpen={moveModalState.isOpen}
                onClose={() => setMoveModalState({ isOpen: false, itemId: null })}
                currentFolder={currentFolder}
                assetType="music"
                onMove={async (targetFolder) => {
                    if (moveModalState.itemId) {
                        await handleMove(moveModalState.itemId, targetFolder);
                    }
                }}
            />
        </div>
    );
}
