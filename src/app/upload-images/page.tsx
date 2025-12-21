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

    // Folder helpers (simplified for flat list view of folders)
    // Actually, for "Upload Images" it might be better to just select a folder from a dropdown?
    // Or full navigation?
    // User asked: "show folders at first screen".
    // I will implement a simpler folder navigation here since it's an upload page?
    // But existing images grid should probably be organized.

    // Let's implement full nav similar to others for consistency.
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

    const uploadAndGenerate = async () => {
        if (!currentProject) return;
        setUploading(true);
        const supabase = createClient();

        // Process all pending items
        const itemsToProcess = progress.filter(item => item.status === 'pending');

        for (const item of itemsToProcess) {
            // Update status to uploading
            setProgress(prev => prev.map(p =>
                p.id === item.id ? { ...p, status: 'uploading' as const } : p
            ));

            try {
                // Upload image to Supabase Storage
                const fileExt = item.file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('images')
                    .upload(fileName, item.file, { cacheControl: '3600', upsert: false });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('images')
                    .getPublicUrl(uploadData.path);

                // Get image dimensions
                const img = new Image();
                img.src = item.preview;
                await new Promise(resolve => img.onload = resolve);
                const dimensions = { width: img.width, height: img.height };

                // Create image record
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

                // Refresh existing images
                const imgsRes = await fetch(`/api/images?projectId=${currentProject.id}`);
                setExistingImages(await imgsRes.json());

                // ... rest of animation creation ...
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

                // Trigger generation
                try {
                    await fetch('/api/animations/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            animation_id: animation.id,
                            image_url: publicUrl,
                            duration: duration,
                        }),
                    });
                } catch (webhookError) {
                    console.error('Webhook error:', webhookError);
                }

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
        }
        setUploading(false);
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
                                    <button onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')} className="text-sm hover:underline">
                                        ...
                                    </button>
                                )}
                                <span className="text-sm font-mono">{currentFolder}</span>
                            </div>
                            {currentFolder !== '/' && (
                                <button onClick={() => setCurrentFolder(currentFolder.split('/').slice(0, -1).join('/') || '/')} className="text-sm border px-2 py-0.5 rounded hover:bg-muted">Up</button>
                            )}
                        </div>
                    )}
                </div>

                {/* Upload Form */}
                {!uploading ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* ... */}
                        <div className="flex justify-center">
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
                            return (
                                <div
                                    key={folderPath}
                                    onDoubleClick={() => setCurrentFolder(folderPath)}
                                    className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary/50 cursor-pointer"
                                >
                                    <span className="text-4xl">📂</span>
                                    <span className="text-sm font-medium">{folderName}</span>
                                </div>
                            )
                        })}

                        {/* Images */}
                        {visibleImages.map((img, idx) => (
                            <div key={img.id || idx} className="relative group aspect-square bg-card rounded-xl overflow-hidden border border-border">
                                <img
                                    src={img.url || '/placeholder.svg'}
                                    alt={img.filename || 'Image'}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 gap-2">
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
