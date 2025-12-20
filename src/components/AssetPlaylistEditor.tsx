"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Image as ImageIcon, Loader2, Link, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Project } from "@/lib/types";

interface Asset {
    id: string;
    type: 'animation' | 'image' | 'video';
    url: string;
    duration: number;
}

interface ProjectImage {
    id: string;
    url: string;
    filename: string;
}

interface AssetPlaylistEditorProps {
    project: Project;
    onUpdate: (updatedProject: Project) => void;
    onAddAnimation?: () => void;
}

export function AssetPlaylistEditor({ project, onUpdate, onAddAnimation }: AssetPlaylistEditorProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const [showLibrary, setShowLibrary] = useState(false);
    const [libraryImages, setLibraryImages] = useState<ProjectImage[]>([]);
    const [loadingLibrary, setLoadingLibrary] = useState(false);

    const assets = (project as any).template_assets || [];

    // Fetch project images for library picker
    const fetchLibraryImages = useCallback(async () => {
        setLoadingLibrary(true);
        try {
            const response = await fetch(`/api/images?projectId=${project.id}`);
            if (response.ok) {
                const data = await response.json();
                setLibraryImages(data);
            }
        } catch (err) {
            console.error("Failed to fetch library images:", err);
        } finally {
            setLoadingLibrary(false);
        }
    }, [project.id]);

    useEffect(() => {
        if (showLibrary) {
            fetchLibraryImages();
        }
    }, [showLibrary, fetchLibraryImages]);

    const updateProject = async (newAssets: Asset[]) => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("projects")
            .update({ template_assets: newAssets })
            .eq("id", project.id)
            .select()
            .single();

        if (data) onUpdate(data as unknown as Project);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setIsUploading(true);

        try {
            const file = e.target.files[0];

            // Use server-side upload API to bypass storage RLS
            const formData = new FormData();
            formData.append('file', file);
            formData.append('project_id', project.id);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const { url: publicUrl } = await response.json();

            const newAsset: Asset = {
                id: crypto.randomUUID(),
                type: 'image',
                url: publicUrl,
                duration: 5
            };

            await updateProject([...assets, newAsset]);

        } catch (err) {
            console.error("Upload failed:", err);
            alert("Failed to upload image: " + (err as Error).message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleUrlAdd = async () => {
        if (!urlInput.trim()) return;
        const type = (project as any).video_mode === 'image_slideshow' ? 'image' : 'animation';

        const newAsset: Asset = {
            id: crypto.randomUUID(),
            type,
            url: urlInput.trim(),
            duration: type === 'animation' ? 10 : 5
        };

        await updateProject([...assets, newAsset]);
        setUrlInput("");
        setShowUrlInput(false);
    };

    const handleLibrarySelect = async (image: ProjectImage) => {
        const newAsset: Asset = {
            id: crypto.randomUUID(),
            type: 'image',
            url: image.url,
            duration: 5
        };
        await updateProject([...assets, newAsset]);
        setShowLibrary(false);
    };

    const removeAsset = async (index: number) => {
        const newAssets = [...assets];
        newAssets.splice(index, 1);
        await updateProject(newAssets);
    };

    const moveAsset = async (fromIndex: number, direction: 'up' | 'down') => {
        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= assets.length) return;

        const newAssets = [...assets];
        const item = newAssets.splice(fromIndex, 1)[0];
        newAssets.splice(toIndex, 0, item);
        await updateProject(newAssets);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    Playlist ({assets.length})
                </h3>
                <div className="flex gap-2">
                    {/* Add Animation - Hidden for Image Slideshow */}
                    {(project as any).video_mode !== 'image_slideshow' && onAddAnimation && (
                        <button
                            onClick={onAddAnimation}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-muted bg-primary/10 text-primary"
                        >
                            <Plus className="w-3 h-3" /> Add Animation
                        </button>
                    )}

                    {/* Image Library - Only for Image Slideshow */}
                    {(project as any).video_mode === 'image_slideshow' && (
                        <button
                            onClick={() => setShowLibrary(true)}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-muted bg-primary/10 text-primary"
                        >
                            <FolderOpen className="w-3 h-3" /> From Library
                        </button>
                    )}

                    <button
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-muted"
                    >
                        <Link className="w-3 h-3" /> URL
                    </button>
                    <label className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        {(project as any).video_mode === 'image_slideshow' ? 'Upload' : 'Upload'}
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                </div>
            </div>

            {showUrlInput && (
                <div className="flex gap-2 p-2 bg-muted/20 rounded-lg">
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 text-sm bg-background border border-border rounded px-2 py-1"
                    />
                    <button onClick={handleUrlAdd} className="bg-primary text-white text-xs px-3 py-1 rounded">Add</button>
                </div>
            )}

            {/* Image Library Modal */}
            {showLibrary && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl max-w-2xl w-full max-h-[70vh] flex flex-col border border-border">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold">Select from Image Library</h3>
                            <button onClick={() => setShowLibrary(false)} className="p-1 hover:bg-muted rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingLibrary ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            ) : libraryImages.length === 0 ? (
                                <div className="text-center py-12 text-muted">
                                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>No images in library yet.</p>
                                    <p className="text-sm">Upload images via the Images page.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {libraryImages.map((img) => (
                                        <button
                                            key={img.id}
                                            onClick={() => handleLibrarySelect(img)}
                                            className="aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {assets.map((asset: Asset, index: number) => (
                    <div key={asset.id} className="group relative flex flex-col gap-2 p-2 rounded-xl border border-border bg-card hover:border-primary/50 transition-all">
                        {/* Preview */}
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                            {asset.url ? (
                                asset.type === 'video' || asset.type === 'animation' ? (
                                    <video src={asset.url} className="w-full h-full object-cover" muted />
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={asset.url} alt="" className="w-full h-full object-cover" />
                                )
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted text-xs">No media</div>
                            )}

                            {/* Controls Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => moveAsset(index, 'up')}
                                    disabled={index === 0}
                                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white disabled:opacity-30"
                                >
                                    ↑
                                </button>
                                <button
                                    onClick={() => moveAsset(index, 'down')}
                                    disabled={index === assets.length - 1}
                                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white disabled:opacity-30"
                                >
                                    ↓
                                </button>
                                <button
                                    onClick={() => removeAsset(index)}
                                    className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-100 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Footer info */}
                        <div className="flex items-center justify-between text-xs text-muted px-1">
                            <span className="truncate max-w-[100px]">{index + 1}. {asset.type}</span>
                            <span>{asset.duration}s</span>
                        </div>
                    </div>
                ))}

                {assets.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted text-sm border-2 border-dashed border-border rounded-xl">
                        Playlist is empty. Add images or animations to start.
                    </div>
                )}
            </div>
        </div>
    );
}
