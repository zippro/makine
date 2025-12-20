"use client";

import { useState, useEffect } from "react";
import { X, Save, AlertCircle, Youtube, Loader2, Play, Layers, List, Image as ImageIcon, Trash2, GripVertical, Type, Plus, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { Project } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface ProjectConfigModalProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updatedProject: Project) => void;
}

type Tab = 'general' | 'mode' | 'playlist' | 'overlays';

interface TemplateAsset {
    id: string;
    type: 'animation' | 'image';
    url: string;
    duration: number;
}

interface OverlayImage {
    id: string;
    url: string;
    start_time: number;
    duration: number;
    position: string;
}

interface TitleConfig {
    enabled: boolean;
    start_time: number;
    duration: number;
    position: string;
    font: string;
    fontSize?: number;
}

interface OverlayConfig {
    images: OverlayImage[];
    title: TitleConfig;
}

export function ProjectConfigModal({ project, isOpen, onClose, onUpdate }: ProjectConfigModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('mode');

    // Youtube State
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [refreshToken, setRefreshToken] = useState("");

    // Config State
    const [videoMode, setVideoMode] = useState<string>("simple_animation");
    const [templateAssets, setTemplateAssets] = useState<TemplateAsset[]>([]);
    const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>({
        images: [],
        title: { enabled: true, start_time: 0, duration: 5, position: "center", font: "Arial" }
    });

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Load Initial Data
    useEffect(() => {
        if (isOpen) {
            // Youtube
            if (project.youtube_creds) {
                setClientId(project.youtube_creds.client_id || "");
                setClientSecret(project.youtube_creds.client_secret || "");
                setRefreshToken(project.youtube_creds.refresh_token || "");
            }
            // Settings (Fallbacks handled)
            setVideoMode((project as any).video_mode || "simple_animation");
            setTemplateAssets((project as any).template_assets || []);
            const defaultOverlay: OverlayConfig = {
                images: [],
                title: { enabled: true, start_time: 0, duration: 5, position: "center", font: "Arial" }
            };
            setOverlayConfig((project as any).overlay_config || defaultOverlay);
        }
    }, [isOpen, project]);

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError("");
        setSuccess("");
        setIsLoading(true);

        try {
            const supabase = createClient();

            // Prepare Update Payload
            const updates: any = {
                video_mode: videoMode,
                template_assets: templateAssets,
                overlay_config: overlayConfig,
            };

            // Only update credentials if inputs are touched/valid
            if (clientId || clientSecret || refreshToken) {
                updates.youtube_creds = {
                    client_id: clientId.trim(),
                    client_secret: clientSecret.trim(),
                    refresh_token: refreshToken.trim()
                };
            }

            const { data, error: updateError } = await supabase
                .from("projects")
                .update(updates)
                .eq("id", project.id)
                .select()
                .single();

            if (updateError) throw updateError;

            setSuccess("Settings saved!");
            if (data) {
                onUpdate(data as unknown as Project);
            }

            setTimeout(() => setSuccess(""), 2000);

        } catch (err: any) {
            setError(err.message || "Failed to save settings");
        } finally {
            setIsLoading(false);
        }
    };

    // Asset Helpers
    const addAsset = () => {
        const newAsset: TemplateAsset = {
            id: crypto.randomUUID(),
            type: videoMode === 'image_slideshow' ? 'image' : 'animation',
            url: "",
            duration: 10
        };
        setTemplateAssets([...templateAssets, newAsset]);
    };

    const removeAsset = (index: number) => {
        const newAssets = [...templateAssets];
        newAssets.splice(index, 1);
        setTemplateAssets(newAssets);
    };

    const moveAsset = (fromIndex: number, direction: 'up' | 'down') => {
        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= templateAssets.length) return;
        const newAssets = [...templateAssets];
        const item = newAssets.splice(fromIndex, 1)[0];
        newAssets.splice(toIndex, 0, item);
        setTemplateAssets(newAssets);
    };

    const updateAsset = (index: number, field: keyof TemplateAsset, value: any) => {
        const newAssets = [...templateAssets];
        (newAssets[index] as any)[field] = value;
        setTemplateAssets(newAssets);
    };

    // Overlay Image Helpers
    const addOverlayImage = () => {
        const newImage: OverlayImage = {
            id: crypto.randomUUID(),
            url: "",
            start_time: 0,
            duration: 5,
            position: "center"
        };
        setOverlayConfig({
            ...overlayConfig,
            images: [...overlayConfig.images, newImage]
        });
    };

    const removeOverlayImage = (index: number) => {
        const newImages = [...overlayConfig.images];
        newImages.splice(index, 1);
        setOverlayConfig({ ...overlayConfig, images: newImages });
    };

    const updateOverlayImage = (index: number, field: keyof OverlayImage, value: any) => {
        const newImages = [...overlayConfig.images];
        (newImages[index] as any)[field] = value;
        setOverlayConfig({ ...overlayConfig, images: newImages });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden border border-border">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                    <h2 className="text-xl font-bold">Config (V2): {project.name}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-56 border-r border-border bg-muted/10 p-3 space-y-1 overflow-y-auto">
                        {[
                            { id: 'mode' as Tab, icon: Play, label: 'Video Mode' },
                            { id: 'playlist' as Tab, icon: List, label: 'Playlist' },
                            { id: 'overlays' as Tab, icon: Layers, label: 'Overlays' },
                            { id: 'general' as Tab, icon: Youtube, label: 'YouTube' },
                        ].filter(tab => {
                            if (tab.id === 'playlist' && videoMode === 'simple_animation') return false;
                            return true;
                        }).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${activeTab === tab.id ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-white/5 text-muted hover:text-foreground'}`}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-background">
                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="space-y-6 max-w-xl">
                                <h3 className="text-lg font-semibold border-b border-border pb-2">YouTube Credentials</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Client ID</label>
                                        <input
                                            type="text"
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Enter Google Client ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Client Secret</label>
                                        <input
                                            type="password"
                                            value={clientSecret}
                                            onChange={(e) => setClientSecret(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Enter Google Client Secret"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Refresh Token</label>
                                        <input
                                            type="password"
                                            value={refreshToken}
                                            onChange={(e) => setRefreshToken(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Enter Google Refresh Token"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MODE TAB */}
                        {activeTab === 'mode' && (
                            <div className="space-y-6 max-w-xl">
                                <h3 className="text-lg font-semibold border-b border-border pb-2">Video Generation Mode</h3>
                                <div className="space-y-3">
                                    {[
                                        { id: 'simple_animation', label: 'Single Animation Loop', desc: 'Choose one animation per video. It loops for the full music duration.' },
                                        { id: 'multi_animation', label: 'Multi-Animation Sequence', desc: 'Create a playlist of animations with custom durations. Loops the sequence.' },
                                        { id: 'image_slideshow', label: 'Image Slideshow', desc: 'Create a playlist of images with custom durations. Loops the sequence.' },
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setVideoMode(mode.id)}
                                            className={`w-full flex items-start gap-4 p-4 rounded-xl text-left border-2 transition-all ${videoMode === mode.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 bg-card'}`}
                                        >
                                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${videoMode === mode.id ? 'border-primary' : 'border-muted'}`}>
                                                {videoMode === mode.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground">{mode.label}</p>
                                                <p className="text-sm text-muted mt-0.5">{mode.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* PLAYLIST TAB */}
                        {activeTab === 'playlist' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <h3 className="text-lg font-semibold">
                                        {videoMode === 'image_slideshow' ? 'Image Playlist' : 'Animation Playlist'}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={addAsset}
                                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Add Item
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {templateAssets.map((asset, index) => (
                                        <div key={asset.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl group hover:border-primary/50 transition-all">
                                            {/* Sort Controls */}
                                            <div className="flex flex-col gap-0.5">
                                                <button type="button" onClick={() => moveAsset(index, 'up')} disabled={index === 0} className="p-1 text-muted hover:text-foreground disabled:opacity-30">
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button type="button" onClick={() => moveAsset(index, 'down')} disabled={index === templateAssets.length - 1} className="p-1 text-muted hover:text-foreground disabled:opacity-30">
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Preview */}
                                            <div className="w-20 h-14 bg-muted rounded overflow-hidden flex-shrink-0">
                                                {asset.url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={asset.url} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted">No URL</div>
                                                )}
                                            </div>

                                            {/* Inputs */}
                                            <div className="flex-1 space-y-2">
                                                <input
                                                    type="text"
                                                    value={asset.url}
                                                    onChange={(e) => updateAsset(index, 'url', e.target.value)}
                                                    placeholder="Paste animation/image URL..."
                                                    className="w-full text-sm bg-background border border-border rounded px-2 py-1.5"
                                                />
                                                <div className="flex items-center gap-3">
                                                    <label className="text-xs text-muted flex items-center gap-1.5">
                                                        Duration (s):
                                                        <input
                                                            type="number"
                                                            value={asset.duration}
                                                            onChange={(e) => updateAsset(index, 'duration', parseInt(e.target.value) || 10)}
                                                            className="w-16 text-xs bg-background border border-border rounded px-2 py-1"
                                                            min="1"
                                                        />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button type="button" onClick={() => removeAsset(index)} className="p-2 text-muted hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {templateAssets.length === 0 && (
                                        <div className="text-center py-12 text-muted border-2 border-dashed border-border rounded-xl">
                                            No items added yet. Click "Add Item" to start.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* OVERLAYS TAB */}
                        {activeTab === 'overlays' && (
                            <div className="space-y-8 max-w-xl">
                                {/* Title Config */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border pb-2">
                                        <Type className="w-5 h-5" /> Video Title Overlay
                                    </h3>
                                    <div className="p-4 bg-card border border-border rounded-xl space-y-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={overlayConfig.title?.enabled ?? true}
                                                onChange={(e) => setOverlayConfig({
                                                    ...overlayConfig,
                                                    title: { ...overlayConfig.title, enabled: e.target.checked }
                                                })}
                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                            />
                                            <span className="font-medium">Show Title in Video</span>
                                        </label>

                                        {overlayConfig.title?.enabled && (
                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Start Time (s)</label>
                                                    <input
                                                        type="number"
                                                        value={overlayConfig.title?.start_time ?? 0}
                                                        onChange={(e) => setOverlayConfig({
                                                            ...overlayConfig,
                                                            title: { ...overlayConfig.title, start_time: parseFloat(e.target.value) || 0 }
                                                        })}
                                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Duration (s)</label>
                                                    <input
                                                        type="number"
                                                        value={overlayConfig.title?.duration ?? 5}
                                                        onChange={(e) => setOverlayConfig({
                                                            ...overlayConfig,
                                                            title: { ...overlayConfig.title, duration: parseFloat(e.target.value) || 5 }
                                                        })}
                                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                                                        min="1"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Font</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={overlayConfig.title?.font || 'Arial'}
                                                            onChange={(e) => setOverlayConfig({
                                                                ...overlayConfig,
                                                                title: { ...overlayConfig.title, font: e.target.value }
                                                            })}
                                                            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm"
                                                        >
                                                            <option value="Arial">Arial</option>
                                                            <option value="Helvetica">Helvetica</option>
                                                            <option value="Times New Roman">Times New Roman</option>
                                                            <option value="Georgia">Georgia</option>
                                                            <option value="Verdana">Verdana</option>
                                                            <option value="Impact">Impact</option>
                                                        </select>
                                                        <input
                                                            type="number"
                                                            value={overlayConfig.title?.fontSize ?? 60}
                                                            onChange={(e) => setOverlayConfig({
                                                                ...overlayConfig,
                                                                title: { ...overlayConfig.title, fontSize: parseInt(e.target.value) || 60 }
                                                            })}
                                                            className="w-20 bg-background border border-border rounded px-3 py-2 text-sm"
                                                            min="10"
                                                            max="200"
                                                            placeholder="Size"
                                                            title="Font Size"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Position</label>
                                                    <select
                                                        value={overlayConfig.title?.position || 'center'}
                                                        onChange={(e) => setOverlayConfig({
                                                            ...overlayConfig,
                                                            title: { ...overlayConfig.title, position: e.target.value }
                                                        })}
                                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                                                    >
                                                        <option value="center">Center</option>
                                                        <option value="top">Top</option>
                                                        <option value="bottom">Bottom</option>
                                                        <option value="top_left">Top Left</option>
                                                        <option value="top_right">Top Right</option>
                                                        <option value="bottom_left">Bottom Left</option>
                                                        <option value="bottom_right">Bottom Right</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Image Overlays */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-border pb-2">
                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                            <ImageIcon className="w-5 h-5" /> Image Overlays
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={addOverlayImage}
                                            className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" /> Add Image
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {overlayConfig.images.map((img, index) => (
                                            <div key={img.id} className="p-3 bg-card border border-border rounded-xl space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0 relative group">
                                                        {img.url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={img.url} className="w-full h-full object-cover" alt="" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-xs text-muted">No URL</div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={img.url}
                                                            onChange={(e) => updateOverlayImage(index, 'url', e.target.value)}
                                                            placeholder="Image URL..."
                                                            className="flex-1 text-sm bg-background border border-border rounded px-2 py-1.5"
                                                        />
                                                        <label className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded cursor-pointer transition-colors" title="Upload Image">
                                                            <Upload className="w-4 h-4" />
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={async (e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;

                                                                    try {
                                                                        const supabase = createClient();
                                                                        const fileExt = file.name.split('.').pop();
                                                                        const fileName = `overlay-${Date.now()}-${Math.random()}.${fileExt}`;
                                                                        // Use 'uploads' bucket as it is known to work
                                                                        const { error: upErr } = await supabase.storage.from('uploads').upload(fileName, file);
                                                                        if (upErr) throw upErr;

                                                                        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
                                                                        updateOverlayImage(index, 'url', publicUrl);
                                                                    } catch (err) {
                                                                        console.error('Upload failed', err);
                                                                        alert('Failed to upload image');
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                    <button type="button" onClick={() => removeOverlayImage(index)} className="p-2 text-muted hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="text-xs text-muted block mb-1">Start (s)</label>
                                                        <input
                                                            type="number"
                                                            value={img.start_time}
                                                            onChange={(e) => updateOverlayImage(index, 'start_time', parseFloat(e.target.value) || 0)}
                                                            className="w-full text-sm bg-background border border-border rounded px-2 py-1"
                                                            min="0"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-muted block mb-1">Duration (s)</label>
                                                        <input
                                                            type="number"
                                                            value={img.duration}
                                                            onChange={(e) => updateOverlayImage(index, 'duration', parseFloat(e.target.value) || 5)}
                                                            className="w-full text-sm bg-background border border-border rounded px-2 py-1"
                                                            min="1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-muted block mb-1">Position</label>
                                                        <select
                                                            value={img.position}
                                                            onChange={(e) => updateOverlayImage(index, 'position', e.target.value)}
                                                            className="w-full text-sm bg-background border border-border rounded px-2 py-1"
                                                        >
                                                            <option value="center">Center</option>
                                                            <option value="top_left">Top Left</option>
                                                            <option value="top_right">Top Right</option>
                                                            <option value="bottom_left">Bottom Left</option>
                                                            <option value="bottom_right">Bottom Right</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {overlayConfig.images.length === 0 && (
                                            <div className="text-center py-8 text-muted text-sm border-2 border-dashed border-border rounded-xl">
                                                No image overlays. Add one to overlay on the video.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        {error && (
                            <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mt-6 p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                {success}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => handleSave()}
                        disabled={isLoading}
                        className="btn-primary px-6 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
