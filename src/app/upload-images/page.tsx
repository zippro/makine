'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import ImageUploader from '@/components/ImageUploader';
import AnimationDurationSelect from '@/components/AnimationDurationSelect';
import UploadProgress, { UploadStatus } from '@/components/UploadProgress';
import { useProject } from '@/context/ProjectContext';
import { MoveAssetModal } from '@/components/MoveAssetModal';
import { Folder } from 'lucide-react';

export default function UploadImagesPage() {
    const { currentProject } = useProject();
    const [duration, setDuration] = useState<5 | 10>(10);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadStatus[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [existingImages, setExistingImages] = useState<any[]>([]);
    const [currentFolder, setCurrentFolder] = useState<string>('/');
    const [projectFolders, setProjectFolders] = useState<any[]>([]);
    const [moveModalState, setMoveModalState] = useState<{ isOpen: boolean; itemId: string | null }>({ isOpen: false, itemId: null });

    // Drag & Drop State
    const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

    // Bulk Selection State
    const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // ... (fetch logic remains same) ...

    useEffect(() => {
        if (currentProject) {
            fetch(`/api/images?projectId=${currentProject.id}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setExistingImages(data);
                })
                .catch(err => {
                    console.error("Failed to load existing images:", err);
                    setError(err.message);
                });

            fetch(`/api/folders?projectId=${currentProject.id}`)
                .then(async res => {
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) setProjectFolders(data);
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        const errMsg = errData.error || 'Failed to fetch folders';
                        if (errMsg.includes('Configuration Error')) setError(errMsg);
                    }
                })
                .catch(err => {
                    console.error("Failed to load folders:", err);
                    setError(`Folder Error: ${err.message}`);
                });
        }
    }, [currentProject]);

    // Folder helpers
    const getFolderContents = (files: any[], folder: string) => {
        return files.filter(f => (f.folder || '/') === folder);
    };

    const getSubfolders = (files: any[], currentPath: string) => {
        const folders = new Set<string>();
        // 1. Persistent
        projectFolders.forEach(pf => {
            const fPath = pf.path;
            if (fPath !== currentPath && fPath.startsWith(currentPath)) {
                const rel = fPath.slice(currentPath.length + (currentPath === '/' ? 0 : 1));
                const firstPart = rel.split('/')[0];
                if (firstPart) folders.add(currentPath === '/' ? `/${firstPart}` : `${currentPath}/${firstPart}`);
            }
        });
        // 2. Files
        files.forEach(f => {
            const fPath = f.folder || '/';
            if (fPath !== currentPath && fPath.startsWith(currentPath)) {
                const rel = fPath.slice(currentPath.length + (currentPath === '/' ? 0 : 1));
                const firstPart = rel.split('/')[0];
                if (firstPart) folders.add(currentPath === '/' ? `/${firstPart}` : `${currentPath}/${firstPart}`);
            }
        });
        return Array.from(folders).sort();
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedImageIds.size} images?`)) return;

        const idsToDelete = Array.from(selectedImageIds);
        setIsSelectionMode(false); // Disable selection mode during deletion

        // Optimistic update
        const remainingImages = existingImages.filter(img => !selectedImageIds.has(img.id));
        setExistingImages(remainingImages);
        setSelectedImageIds(new Set());

        let errors = 0;
        for (const id of idsToDelete) {
            try {
                const res = await fetch(`/api/images?id=${id}`, { method: 'DELETE' });
                if (!res.ok) errors++;
            } catch (e) {
                console.error("Failed to delete", id, e);
                errors++;
            }
        }

        if (errors > 0) {
            alert(`Failed to delete ${errors} images. They may have reappeared.`);
            // Refresh to ensure state consistency
            if (currentProject) {
                const res = await fetch(`/api/images?projectId=${currentProject.id}`);
                setExistingImages(await res.json());
            }
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedImageIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedImageIds(next);
    };

    const toggleSelectAll = (filesInView: any[]) => {
        if (selectedImageIds.size === filesInView.length) {
            setSelectedImageIds(new Set());
        } else {
            setSelectedImageIds(new Set(filesInView.map(f => f.id)));
        }
    };

    const handleFilesSelected = (files: File[]) => {
        if (!currentProject) {
            setError("Please select a project first");
            return;
        }
        setError(null);

        const newItems: UploadStatus[] = files.map(file => ({
            id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            file,
            preview: URL.createObjectURL(file),
            status: 'pending' as const,
        }));

        setProgress(prev => [...prev, ...newItems]);
    };

    const removeImage = (id: string) => {
        setProgress(prev => {
            const item = prev.find(img => img.id === id);
            if (item) {
                URL.revokeObjectURL(item.preview);
            }
            return prev.filter(img => img.id !== id);
        });
    };

    const handlePromptChange = (id: string, prompt: string) => {
        setProgress(prev => prev.map(img =>
            img.id === id ? { ...img, prompt } : img
        ));
    };

    const uploadAndGenerate = async () => {
        if (!currentProject) return;
        setUploading(true);
        const supabase = createClient();

        // Process all pending items
        const itemsToProcess = progress.filter(item => item.status === 'pending');

        // Parallel processing using map and Promise.all
        await Promise.all(itemsToProcess.map(async (item) => {
            // Update status to uploading
            setProgress(prev => prev.map(p =>
                p.id === item.id ? { ...p, status: 'uploading' as const } : p
            ));

            try {
                // Resize image if needed (Max 2048x2048, 0.8 quality)
                const resizedBlob = await resizeImage(item.file, 2048, 2048, 0.8);
                const fileExt = item.file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                // HETZNER STORAGE MIGRATION
                // Upload directly to VP instead of Supabase
                const formData = new FormData();
                formData.append('type', 'images'); // server saves to /var/www/images
                formData.append('file', resizedBlob, fileName);

                // Use env var or fallback
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

                // Legacy: Mock the supabase return so we don't break downstream if it used uploadData
                // But we only used publicUrl.

                // Get image dimensions
                const img = new Image();
                img.src = item.preview;
                await new Promise(resolve => img.onload = resolve);
                const dimensions = { width: img.width, height: img.height };

                // Create image record
                // NOTE: We use 'folder: currentFolder' here. API fix ensures it is saved.
                const response = await fetch('/api/images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: publicUrl,
                        filename: item.file.name,
                        file_size: item.file.size,
                        width: dimensions.width,
                        height: dimensions.height,
                        project_id: currentProject.id,
                        folder: currentFolder // Include current folder
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to create image record');
                }
                const imageRecord = await response.json();

                // Update status to uploaded
                setProgress(prev => prev.map(p =>
                    p.id === item.id ? { ...p, status: 'uploaded' as const, url: publicUrl } : p
                ));

                // Create animation record
                setProgress(prev => prev.map(p =>
                    p.id === item.id ? { ...p, status: 'generating' as const } : p
                ));

                const { data: animation, error: animError } = await supabase
                    .from('animations')
                    .insert({
                        image_id: imageRecord.id,
                        duration: duration,
                        status: 'queued',
                        project_id: currentProject.id,
                        folder: currentFolder // Inherit folder
                    })
                    .select()
                    .single();

                if (animError) throw animError;

                // Trigger generation (Fire and Forget)
                fetch('/api/animations/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        animation_id: animation.id,
                        image_url: publicUrl,
                        duration: duration,
                        prompt: item.prompt
                    }),
                }).catch(err => console.error('Webhook trigger error:', err));

                // Immediately set to done (queued)
                setProgress(prev => prev.map(p =>
                    p.id === item.id ? { ...p, status: 'done' as const, animationId: animation.id } : p
                ));

            } catch (error) {
                console.error('Error processing image:', error);
                setProgress(prev => prev.map(p =>
                    p.id === item.id ? { ...p, status: 'error' as const, error: (error as Error).message } : p
                ));
            } finally {
                URL.revokeObjectURL(item.preview);
            }
        }));

        setUploading(false);
        // Refresh existing images after batch
        const imgsRes = await fetch(`/api/images?projectId=${currentProject.id}`);
        setExistingImages(await imgsRes.json());
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this image?')) return;
        try {
            const res = await fetch(`/api/images?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            // Refresh
            if (currentProject) {
                const imgsRes = await fetch(`/api/images?projectId=${currentProject.id}`);
                setExistingImages(await imgsRes.json());
            }
        } catch (err) {
            alert('Failed to delete image');
        }
    };

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedImageId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e: React.DragEvent, folderPath: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolder(folderPath);
    };

    const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
        e.preventDefault();
        setDragOverFolder(null);

        // Check for file upload drop (if no draggedImageId)
        if (!draggedImageId) {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                // Switch to target folder
                setCurrentFolder(targetFolder);
                // Queue files
                handleFilesSelected(files);
            }
            return;
        }

        // Move existing item logic
        try {
            const res = await fetch('/api/images', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: draggedImageId,
                    project_id: currentProject?.id,
                    folder: targetFolder
                })
            });

            if (res.ok) {
                const r = await fetch(`/api/images?projectId=${currentProject?.id}`);
                setExistingImages(await r.json());
            } else {
                alert('Failed to move image');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDraggedImageId(null);
        }
    };


    // ... render logic ...
    const visibleFolders = getSubfolders(existingImages, currentFolder);
    const visibleImages = getFolderContents(existingImages, currentFolder);

    const doneCount = progress.filter(item => item.status === 'done').length;

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
                {/* ... header ... */}
                <div className="text-center mb-12">
                    {/* ... title ... */}
                    <h1 className="text-4xl font-bold gradient-text mb-4">
                        Upload Source Images
                    </h1>
                    {currentProject && (
                        <div className="flex items-center justify-center gap-2 mt-4 text-muted">
                            <span>Folder:</span>
                            <div className="flex items-center gap-1 bg-muted/20 px-3 py-1 rounded-full">
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
                            {currentFolder !== '/' && (
                                <button
                                    onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                    onDragOver={(e) => handleDragOver(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                    onDrop={(e) => handleDrop(e, currentFolder.split('/').slice(0, -1).join('/') || '/')}
                                    className={`text-sm border px-2 py-0.5 rounded transition-all
                                        ${dragOverFolder === (currentFolder.split('/').slice(0, -1).join('/') || '/') ? 'bg-primary text-black border-primary' : 'hover:bg-muted'}
                                    `}
                                >
                                    Up
                                </button>
                            )}
                            <button
                                onClick={async () => {
                                    const name = prompt('New Folder:');
                                    if (name) {
                                        const newPath = currentFolder === '/' ? `/${name}` : `${currentFolder}/${name}`;
                                        await fetch('/api/folders', { method: 'POST', body: JSON.stringify({ project_id: currentProject?.id, path: newPath }) });
                                        const res = await fetch(`/api/folders?projectId=${currentProject?.id}`);
                                        setProjectFolders(await res.json());
                                        setCurrentFolder(newPath);
                                    }
                                }}
                                className="ml-2 pt-1 pb-1 pl-3 pr-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
                            >
                                + New Folder
                            </button>
                        </div>
                    )}
                </div>

                {/* Upload Form */}
                {!uploading ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* ... */}
                        <div className="flex justify-center flex-col items-center gap-2">
                            <div className="bg-white/5 px-4 py-1 rounded-full text-xs text-muted-foreground border border-white/10 mb-2">
                                Uploading to: <span className="text-white font-mono font-medium">{currentFolder === '/' ? 'Root Folder' : currentFolder}</span>
                            </div>
                            <AnimationDurationSelect
                                value={duration}
                                onChange={setDuration}
                            />
                        </div>

                        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-2 shadow-xl ring-1 ring-white/10">
                            <ImageUploader
                                onFilesSelected={handleFilesSelected}
                                disabled={!currentProject}
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-center">
                                {error}
                            </div>
                        )}
                    </div>
                ) : null}

                {/* ... progress ... */}
                <div className="mt-8">
                    <UploadProgress
                        items={progress}
                        onRemove={removeImage}
                        onPromptChange={handlePromptChange}
                        onUpload={uploadAndGenerate}
                        uploading={uploading}
                    />
                </div>

                {doneCount > 0 && ( /* ... */
                    <div className="mt-8 p-4 rounded-xl bg-success/10 border border-success/20 text-center">
                        <p className="text-success font-medium">
                            {doneCount} animation{doneCount !== 1 ? 's' : ''} queued for generation.{' '}
                            <a href="/animations" className="underline hover:no-underline">
                                View Animations →
                            </a>
                        </p>
                    </div>
                )}
            </div>

            {/* Existing Images Gallery with Folders */}
            {(existingImages.length > 0 || projectFolders.length > 0) && (
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Existing Images in Project</h2>
                        <div className="flex items-center gap-2">
                            {isSelectionMode ? (
                                <>
                                    <span className="text-sm text-muted-foreground mr-2">{selectedImageIds.size} selected</span>
                                    <button
                                        onClick={() => toggleSelectAll(visibleImages)}
                                        className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded"
                                    >
                                        {selectedImageIds.size === visibleImages.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={selectedImageIds.size === 0}
                                        className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 rounded disabled:opacity-50"
                                    >
                                        Delete Selected
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsSelectionMode(false);
                                            setSelectedImageIds(new Set());
                                        }}
                                        className="px-3 py-1.5 text-xs hover:bg-white/10 rounded"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsSelectionMode(true)}
                                    className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded flex items-center gap-2"
                                >
                                    <span className="w-4 h-4 border border-current rounded-sm"></span>
                                    Select Multiple
                                </button>
                            )}
                        </div>
                        <button onClick={async () => {
                            const name = prompt('New Folder:');
                            if (name) {
                                const newPath = currentFolder === '/' ? `/${name}` : `${currentFolder}/${name}`;
                                await fetch('/api/folders', { method: 'POST', body: JSON.stringify({ project_id: currentProject?.id, path: newPath }) });
                                // Refresh folders
                                const res = await fetch(`/api/folders?projectId=${currentProject?.id}`);
                                setProjectFolders(await res.json());
                                setCurrentFolder(newPath);
                            }
                        }} className="text-sm bg-primary/10 text-primary px-3 py-1 rounded hover:bg-primary/20">+ New Folder</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {/* Folders */}
                        {visibleFolders.map(folderPath => {
                            const folderName = folderPath.split('/').pop();
                            // Calculate count
                            const count = existingImages.filter(img => {
                                const f = img.folder || '/';
                                return f === folderPath || f.startsWith(folderPath + '/');
                            }).length;

                            const isDragOver = dragOverFolder === folderPath;

                            return (
                                <div
                                    key={folderPath}
                                    onDoubleClick={() => setCurrentFolder(folderPath)}
                                    // Drag Handlers
                                    onDragOver={(e) => handleDragOver(e, folderPath)}
                                    onDrop={(e) => handleDrop(e, folderPath)}
                                    className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
                                        ${isDragOver
                                            ? 'border-primary bg-primary/10 scale-105 shadow-xl text-primary'
                                            : 'border-border hover:border-primary/50 text-muted hover:text-foreground'
                                        }
                                    `}
                                >
                                    <Folder className={`w-12 h-12 ${isDragOver ? 'animate-bounce' : ''}`} />
                                    <span className="text-sm font-medium">{folderName}</span>
                                    <span className="text-xs text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</span>
                                </div>
                            )
                        })}

                        {/* Images */}
                        {visibleImages.map((img, idx) => (
                            <div
                                key={img.id || idx}
                                draggable={!isSelectionMode}
                                onDragStart={(e) => {
                                    if (!isSelectionMode) handleDragStart(e, img.id);
                                }}
                                onClick={() => {
                                    if (isSelectionMode) toggleSelection(img.id);
                                }}
                                className={`relative group aspect-square bg-card rounded-xl overflow-hidden border transition-all cursor-pointer
                                    ${isSelectionMode && selectedImageIds.has(img.id) ? 'ring-2 ring-primary border-primary' : 'border-border'}
                                    ${!isSelectionMode && draggedImageId === img.id ? 'opacity-50 border-primary border-dashed' : ''}
                                `}
                            >
                                <img
                                    src={img.url || '/placeholder.svg'}
                                    alt={img.filename || 'Image'}
                                    className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${isSelectionMode && selectedImageIds.has(img.id) ? 'opacity-60' : ''}`}
                                />

                                {isSelectionMode && (
                                    <div className="absolute top-2 left-2 z-10">
                                        <div className={`
                                            w-6 h-6 rounded-md border flex items-center justify-center transition-colors shadow-sm
                                            ${selectedImageIds.has(img.id) ? 'bg-primary border-primary' : 'bg-black/40 border-white/50'}
                                        `}>
                                            {selectedImageIds.has(img.id) && <div className="w-3 h-3 bg-white rounded-sm" />}
                                        </div>
                                    </div>
                                )}

                                <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 gap-2 ${isSelectionMode ? 'hidden' : ''}`}>
                                    <div className="flex justify-between items-end">
                                        <p className="text-white text-xs truncate flex-1 mr-2">{img.filename || 'Untitled'}</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMoveModalState({ isOpen: true, itemId: img.id });
                                            }}
                                            className="text-xs bg-white/20 hover:bg-white/40 text-white px-2 py-1 rounded backdrop-blur-sm transition-colors"
                                        >
                                            Move
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(img.id);
                                            }}
                                            className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-white px-2 py-1 rounded backdrop-blur-sm transition-colors ml-2 border border-red-500/20"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <MoveAssetModal
                isOpen={moveModalState.isOpen}
                onClose={() => setMoveModalState({ isOpen: false, itemId: null })}
                currentFolder={currentFolder}
                assetType="image"
                onMove={async (targetFolder) => {
                    if (moveModalState.itemId && currentProject) {
                        const res = await fetch('/api/images', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: moveModalState.itemId,
                                project_id: currentProject.id,
                                folder: targetFolder
                            })
                        });

                        if (res.ok) {
                            const r = await fetch(`/api/images?projectId=${currentProject.id}`);
                            setExistingImages(await r.json());
                        } else {
                            alert('Failed to move image');
                        }
                    }
                }}
            />
        </div>
    );
}

// ... helper unchanged ...

// Helper for client-side resizing
const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                } else {
                    // Check if file is small enough to not need processed
                    if (file.size < 1024 * 1024) { // < 1MB
                        resolve(file);
                        return;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file); // Fallback
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else resolve(file);
                }, file.type, quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
