"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Image as ImageIcon, Loader2, Link, FolderOpen, Video, Clock, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Project } from "@/lib/types";

interface Asset {
    id: string;
    type: 'animation' | 'image' | 'video';
    url: string;
    duration: number;
    loop_count?: number;
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
                duration: project.default_image_duration || 15
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
        // Guess type
        const isVideo = urlInput.match(/\.(mp4|webm|mov)$/i);
        const type = isVideo ? 'animation' : 'image';

        const newAsset: Asset = {
            id: crypto.randomUUID(),
            type,
            url: urlInput.trim(),
            duration: type === 'image'
                ? (project.default_image_duration || 15)
                : 10,
            loop_count: type === 'animation'
                ? (project.default_loop_count || 1)
                : undefined
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
            duration: project.default_image_duration || 15
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

    const updateAssetProperty = async (index: number, field: keyof Asset, value: any) => {
        const newAssets = [...assets];
        (newAssets[index] as any)[field] = value;
        await updateProject(newAssets);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    Playlist Sequence ({assets.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                    {onAddAnimation && (
                        <button
                            onClick={onAddAnimation}
                            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-muted bg-primary/10 text-primary border border-transparent hover:border-primary/20 transition-all font-medium"
                        >
                            <Plus className="w-3 h-3" /> Add Animation
                        </button>
                    )}

                    <button
                        onClick={() => setShowLibrary(true)}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-muted bg-primary/10 text-primary border border-transparent hover:border-primary/20 transition-all font-medium"
                    >
                        <FolderOpen className="w-3 h-3" /> Add Image
                    </button>

                    <button
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-muted border border-border"
                    >
                        <Link className="w-3 h-3" /> URL
                    </button>
                    <label className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-muted border border-border cursor-pointer">
                        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                </div>
            </div>

            {showUrlInput && (
                <div className="flex gap-2 p-2 bg-muted/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 text-sm bg-background border border-border rounded px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <button onClick={handleUrlAdd} className="bg-primary text-black text-xs px-4 py-2 rounded font-medium hover:bg-primary/90">Add</button>
                </div>
            )}

            {/* Image Library Modal */}
            {showLibrary && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl max-w-2xl w-full max-h-[70vh] flex flex-col border border-border shadow-2xl">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold">Select from Image Library</h3>
                            <button onClick={() => setShowLibrary(false)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
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
                                            className="aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all group relative"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img.url} alt={img.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {assets.map((asset: Asset, index: number) => {
                    const isAnim = asset.type === 'animation' || asset.type === 'video';
                    return (
                        <div key={asset.id} className="group relative flex items-center gap-4 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all">

                            {/* Number & Type Icon */}
                            <div className="flex flex-col items-center justify-center gap-1 w-8 text-muted-foreground">
                                <span className="text-xs font-mono">{index + 1}</span>
                                {isAnim ? <Video className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                            </div>

                            {/* Preview */}
                            <div className="w-24 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0 border border-border">
                                {asset.url ? (
                                    isAnim ? (
                                        <video src={asset.url} className="w-full h-full object-cover" muted />
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={asset.url} alt="" className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted text-xs">No media</div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 gap-4">
                                {/* Duration / Loop Controls */}
                                {isAnim ? (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                                            <Repeat className="w-3 h-3" /> Loop Count
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={asset.loop_count || 1}
                                            onChange={(e) => updateAssetProperty(index, 'loop_count', parseInt(e.target.value) || 1)}
                                            className="w-full bg-background border border-border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Duration (s)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="300"
                                            step="0.5"
                                            value={asset.duration || 5}
                                            onChange={(e) => updateAssetProperty(index, 'duration', parseFloat(e.target.value) || 5)}
                                            className="w-full bg-background border border-border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => moveAsset(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1.5 bg-muted hover:bg-muted/80 rounded text-foreground disabled:opacity-30"
                                        title="Move Up"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        onClick={() => moveAsset(index, 'down')}
                                        disabled={index === assets.length - 1}
                                        className="p-1.5 bg-muted hover:bg-muted/80 rounded text-foreground disabled:opacity-30"
                                        title="Move Down"
                                    >
                                        ↓
                                    </button>
                                </div>
                                <button
                                    onClick={() => removeAsset(index)}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                                    title="Remove"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {assets.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted text-sm border-2 border-dashed border-border rounded-xl">
                        Playlist is empty. Add animations or images to create a sequence.
                    </div>
                )}
            </div>
        </div>
    );
}
