"use client";

import { useState } from "react";
import { Plus, X, Image as ImageIcon, Video, Clock, Repeat } from "lucide-react";
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
    onAddImage?: () => void;
}

export function AssetPlaylistEditor({ project, onUpdate, onAddAnimation, onAddImage }: AssetPlaylistEditorProps) {
    const assets = (project as any).template_assets || [];

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

                    {onAddImage && (
                        <button
                            onClick={onAddImage}
                            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-muted bg-primary/10 text-primary border border-transparent hover:border-primary/20 transition-all font-medium"
                        >
                            <ImageIcon className="w-3 h-3" /> Add Image
                        </button>
                    )}
                </div>
            </div>

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
