'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import ImageUploader from '@/components/ImageUploader';
import AnimationDurationSelect from '@/components/AnimationDurationSelect';
import UploadProgress, { UploadStatus } from '@/components/UploadProgress';
import { useProject } from '@/context/ProjectContext';

export default function UploadImagesPage() {
    const { currentProject } = useProject();
    const [duration, setDuration] = useState<5 | 10>(10);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadStatus[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [existingImages, setExistingImages] = useState<any[]>([]);

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
        }
    }, [currentProject]);

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
                        project_id: currentProject.id
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
                        project_id: currentProject.id // Ensure animation is also scoped if the table has project_id
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

    const doneCount = progress.filter(item => item.status === 'done').length;

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold gradient-text mb-4">
                        Upload Source Images
                    </h1>
                    <p className="text-muted text-lg max-w-2xl mx-auto">
                        {currentProject ? `Project: ${currentProject.name}` : 'Select a project to upload images'}
                    </p>
                </div>

                {!uploading ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

                <div className="mt-8">
                    <UploadProgress
                        items={progress}
                        onRemove={removeImage}
                        onUpload={uploadAndGenerate}
                        uploading={uploading}
                    />
                </div>

                {doneCount > 0 && (
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

            {/* Existing Images Gallery */}
            {existingImages.length > 0 && (
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
                    <h2 className="text-2xl font-bold mb-6">Existing Images in Project</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {existingImages.map((img, idx) => (
                            <div key={img.id || idx} className="relative group aspect-square bg-card rounded-xl overflow-hidden border border-border">
                                <img
                                    src={img.url || '/placeholder.svg'}
                                    alt={img.filename || 'Image'}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                    <p className="text-white text-xs truncate w-full">{img.filename || 'Untitled'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
