"use client";

import { useState, useEffect } from "react";
import { X, Save, AlertCircle, Youtube, Loader2, Play, Layers, List, Image as ImageIcon, Trash2, GripVertical, Type, Plus, ChevronUp, ChevronDown, Upload, Music } from "lucide-react";
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
    loop_count?: number;
}

interface OverlayImage {
    id: string;
    url: string;
    start_time: number;
    duration: number;
    position: string;
    fade_duration?: number;
}

interface TitleConfig {
    enabled: boolean;
    start_time: number;
    duration: number;
    position: string;
    font: string;
    fontSize?: number;
    fade_duration?: number;
}

interface VisualizerConfig {
    enabled: boolean;
    style: 'bar' | 'line';
    color: string;
    position: 'bottom' | 'top';
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
    const [defaultLoopCount, setDefaultLoopCount] = useState<number>(1);
    const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>({
        images: [],
        title: { enabled: true, start_time: 0, duration: 5, position: "center", font: "Arial", fade_duration: 1 }
    });
    const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig>({
        enabled: false,
        style: 'bar',
        color: '#ffffff',
        position: 'bottom'
    });
    const [projectFonts, setProjectFonts] = useState<any[]>([]);

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
            setDefaultLoopCount((project as any).default_loop_count || 1);

            const defaultOverlay: OverlayConfig = {
                images: [],
                title: { enabled: true, start_time: 0, duration: 5, position: "center", font: "Arial" }
            };
            setOverlayConfig((project as any).overlay_config || defaultOverlay);
            setVisualizerConfig((project as any).visualizer_config || { enabled: false, style: 'bar', color: '#ffffff', position: 'bottom' });

            // Fetch Fonts
            fetch(`/api/fonts?projectId=${project.id}`)
                .then(res => res.json())
                .then(data => { if (Array.isArray(data)) setProjectFonts(data); })
                .catch(console.error);
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
                visualizer_config: visualizerConfig,
                default_loop_count: defaultLoopCount
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
    // Local state for inputs to prevent cursor jumping/validation locking
    const [localLoopCount, setLocalLoopCount] = useState<string>((project.default_loop_count || 1).toString());
    const [localTitleFontSize, setLocalTitleFontSize] = useState<string>((overlayConfig.title?.fontSize || 60).toString());

    // Sync local state when props change (external updates)
    useEffect(() => {
        setLocalLoopCount((defaultLoopCount || 1).toString());
    }, [defaultLoopCount]);

    useEffect(() => {
        setLocalTitleFontSize((overlayConfig.title?.fontSize || 60).toString());
    }, [overlayConfig.title?.fontSize]);

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
                                    {/* Existing Credentials */}
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

                                {/* Global Loop Count Setting */}
                                {videoMode !== 'simple_animation' && (
                                    <div className="pt-4 border-t border-border mt-4">
                                        <label className="text-sm font-medium mb-1 block">Animation Loop Count (Standard)</label>
                                        <p className="text-xs text-muted mb-2">Each animation in the playlist will loop this many times.</p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={localLoopCount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setLocalLoopCount(val); // Always update local state

                                                    // Only update parent if valid
                                                    const num = parseInt(val);
                                                    if (!isNaN(num) && num >= 1) {
                                                        setDefaultLoopCount(num);
                                                    }
                                                }}
                                                className="w-24 bg-background border border-border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                                min="1"
                                                placeholder="1"
                                            />
                                            <span className="text-sm text-muted">times per asset</span>
                                        </div>
                                    </div>
                                )}
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
                                                    {asset.type === 'animation' ? (
                                                        <span className="text-xs text-muted">
                                                            Loop: {defaultLoopCount}x (Global)
                                                        </span>
                                                    ) : (
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
                                                    )}
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
                                                    <label className="text-xs text-muted block mb-1">Fade Duration (s)</label>
                                                    <input
                                                        type="number"
                                                        value={overlayConfig.title?.fade_duration ?? 0}
                                                        onChange={(e) => setOverlayConfig({
                                                            ...overlayConfig,
                                                            title: { ...overlayConfig.title, fade_duration: parseFloat(e.target.value) || 0 }
                                                        })}
                                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                                                        min="0"
                                                        max="5"
                                                        placeholder="0 (No Fade)"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Font</label>
                                                    <div className="flex gap-2 items-center">
                                                        <select
                                                            value={overlayConfig.title?.font || 'Arial'}
                                                            onChange={(e) => setOverlayConfig({
                                                                ...overlayConfig,
                                                                title: { ...overlayConfig.title, font: e.target.value }
                                                            })}
                                                            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm max-w-[120px]"
                                                        >
                                                            <optgroup label="Standard">
                                                                <option value="Arial">Arial</option>
                                                                <option value="Helvetica">Helvetica</option>
                                                                <option value="Times New Roman">Times New Roman</option>
                                                                <option value="Georgia">Georgia</option>
                                                                <option value="Verdana">Verdana</option>
                                                                <option value="Impact">Impact</option>
                                                            </optgroup>
                                                            {projectFonts.length > 0 && (
                                                                <optgroup label="Custom">
                                                                    {projectFonts.map(f => (
                                                                        <option key={f.id} value={f.name}>{f.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>

                                                        {overlayConfig.title?.font && !['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Impact'].includes(overlayConfig.title.font) && (
                                                            <button
                                                                title="Delete Custom Font"
                                                                onClick={async () => {
                                                                    if (!confirm('Delete this font?')) return;
                                                                    const font = projectFonts.find(f => f.name === overlayConfig.title.font);
                                                                    if (font) {
                                                                        await fetch(`/api/fonts?id=${font.id}`, { method: 'DELETE' });
                                                                        setProjectFonts(prev => prev.filter(p => p.id !== font.id));
                                                                        setOverlayConfig({
                                                                            ...overlayConfig,
                                                                            title: { ...overlayConfig.title, font: 'Arial' }
                                                                        });
                                                                    }
                                                                }}
                                                                className="p-2 text-muted hover:text-red-500"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        <label className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded cursor-pointer transition-colors" title="Upload Font (.ttf, .otf)">
                                                            <Upload className="w-4 h-4" />
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept=".ttf,.otf"
                                                                onChange={async (e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;

                                                                    if (!file.name.endsWith('.ttf') && !file.name.endsWith('.otf')) {
                                                                        alert('Only .ttf and .otf files are supported');
                                                                        return;
                                                                    }

                                                                    try {
                                                                        // 1. Upload
                                                                        const supabase = createClient();
                                                                        const fileExt = file.name.split('.').pop();
                                                                        const fileName = `fonts/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                                                                        // Try 'assets' bucket first, fallback to 'uploads'
                                                                        let bucket = 'assets';
                                                                        let { error: upErr } = await supabase.storage.from(bucket).upload(fileName, file);

                                                                        if (upErr && (upErr.message.includes('not found') || (upErr as any).statusCode === 404)) {
                                                                            bucket = 'uploads'; // Fallback
                                                                            const { error: upErr2 } = await supabase.storage.from(bucket).upload(fileName, file);
                                                                            if (upErr2) throw upErr2;
                                                                        } else if (upErr) {
                                                                            throw upErr;
                                                                        }

                                                                        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

                                                                        // 2. Register
                                                                        const fontName = file.name.replace(/\.[^/.]+$/, ""); // remove extension
                                                                        const res = await fetch('/api/fonts', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({
                                                                                name: fontName,
                                                                                url: publicUrl,
                                                                                project_id: project.id
                                                                            })
                                                                        });

                                                                        if (!res.ok) throw new Error('Failed to save font record');
                                                                        const newFont = await res.json();

                                                                        setProjectFonts(prev => [newFont, ...prev]);
                                                                        setOverlayConfig({
                                                                            ...overlayConfig,
                                                                            title: { ...overlayConfig.title, font: fontName }
                                                                        });

                                                                    } catch (err: any) {
                                                                        console.error('Font upload failed', err);
                                                                        alert(`Failed to upload font: ${err.message}`);
                                                                    }
                                                                }}
                                                            />
                                                        </label>

                                                        <input
                                                            type="number"
                                                            value={localTitleFontSize}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setLocalTitleFontSize(val);

                                                                const num = parseInt(val);
                                                                if (!isNaN(num) && num >= 10) {
                                                                    setOverlayConfig({
                                                                        ...overlayConfig,
                                                                        title: { ...overlayConfig.title, fontSize: num }
                                                                    });
                                                                }
                                                            }}
                                                            className="w-16 bg-background border border-border rounded px-2 py-2 text-sm text-center"
                                                            min="10"
                                                            max="200"
                                                            placeholder="60"
                                                            title="Font Size"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Style</label>
                                                    <select
                                                        value={(overlayConfig.title as any).style || 'standard'}
                                                        onChange={(e) => setOverlayConfig({
                                                            ...overlayConfig,
                                                            title: { ...overlayConfig.title, style: e.target.value } as any
                                                        })}
                                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                                                    >
                                                        <option value="standard">Standard (Shadow)</option>
                                                        <option value="boxed">Boxed (Background)</option>
                                                        <option value="neon">Neon Glow</option>
                                                        <option value="outline">Strong Outline</option>
                                                        <option value="clean">Clean (No Border)</option>
                                                    </select>
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
                                                        <label className="text-xs text-muted block mb-1">Fade (s)</label>
                                                        <input
                                                            type="number"
                                                            value={img.fade_duration || 0}
                                                            onChange={(e) => updateOverlayImage(index, 'fade_duration', parseFloat(e.target.value) || 0)}
                                                            className="w-full text-sm bg-background border border-border rounded px-2 py-1"
                                                            min="0"
                                                            max="5"
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

                                {/* Visualizer Config */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-border pb-2">
                                        <Music className="w-5 h-5" /> Audio Visualizer
                                    </h3>
                                    <div className="p-4 bg-card border border-border rounded-xl space-y-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={visualizerConfig.enabled}
                                                onChange={(e) => setVisualizerConfig({ ...visualizerConfig, enabled: e.target.checked })}
                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                            />
                                            <span className="font-medium">Enable Synchronized Equalizer</span>
                                        </label>

                                        {visualizerConfig.enabled && (
                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Style</label>
                                                    <select
                                                        value={visualizerConfig.style}
                                                        onChange={(e) => setVisualizerConfig({ ...visualizerConfig, style: e.target.value as any })}
                                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                                                    >
                                                        <option value="bar">Bar (Classic)</option>
                                                        <option value="line">Line (Simple)</option>
                                                        <option value="wave">Waveform (Smooth)</option>
                                                        <option value="spectrum">Spectrum (Frequency)</option>
                                                        <option value="round">Circular (Stereo)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Color</label>
                                                    <input
                                                        type="color"
                                                        value={visualizerConfig.color}
                                                        onChange={(e) => setVisualizerConfig({ ...visualizerConfig, color: e.target.value })}
                                                        className="w-full h-9 bg-background border border-border rounded cursor-pointer"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted block mb-1">Position</label>
                                                    <select
                                                        value={visualizerConfig.position}
                                                        onChange={(e) => setVisualizerConfig({ ...visualizerConfig, position: e.target.value as any })}
                                                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                                                    >
                                                        <option value="bottom">Bottom</option>
                                                        <option value="top">Top</option>
                                                    </select>
                                                </div>
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
        </div >
    );
}
