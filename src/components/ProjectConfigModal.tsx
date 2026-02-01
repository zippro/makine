"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, X, Save, AlertCircle, Loader2, Settings, Type, Upload, ImageIcon, Music, Layers, Youtube, Clock, Repeat } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Project } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface ProjectConfigModalProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updatedProject: Project) => void;
}

type Tab = 'general' | 'settings' | 'overlays' | 'templates';

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
    useEscapeKey(onClose);
    const [activeTab, setActiveTab] = useState<Tab>('settings');

    // Youtube State
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [refreshToken, setRefreshToken] = useState("");
    const [channelInfo, setChannelInfo] = useState("");
    const [keywords, setKeywords] = useState("");

    // Config State
    const [defaultLoopCount, setDefaultLoopCount] = useState<number>(1);
    const [defaultImageDuration, setDefaultImageDuration] = useState<number>(15);

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

    // Animation Prompts State
    const [animationPrompts, setAnimationPrompts] = useState<{ id: string; name: string; prompt: string }[]>([
        {
            id: 'loop',
            name: 'Seamless Loop',
            prompt: "Look at this image. Write a single prompt for Kling AI to generate a SEAMLESS LOOP animation based on this image.\n\nUSER CONTEXT: {{user_prompt}}\n\nCRITICAL REQUIREMENTS:\n1. **Loop**: The animation must be a consecutive loop (start frame = end frame).\n2. **Camera**: STATIC CAMERA ONLY. No pan, no zoom, no tilt.\n3. **Motion**: Only small, internal effects (wind, fog, water flow, breathing).\n4. **Output**: A single comma-separated string suitable for image-to-video generation.\n\nAnalyze the subject and depth. Describe the scene and specify subtle motions."
        }
    ]);

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
            // Metadata
            setChannelInfo((project as any).channel_info || "");
            setKeywords((project as any).keywords || "");

            // Settings
            setDefaultLoopCount((project as any).default_loop_count || 1);
            setDefaultImageDuration((project as any).default_image_duration || 15);

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
                .then(data => { if (Array.isArray(data)) setProjectFonts(data); })
                .catch(console.error);

            if (project.animation_prompts && project.animation_prompts.length > 0) {
                setAnimationPrompts(project.animation_prompts);
            }
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
                // Force playlist mode as requested by "Just 1 mode"
                video_mode: 'multi_animation',

                overlay_config: overlayConfig,
                visualizer_config: visualizerConfig,
                // default_loop_count: defaultLoopCount, // Disabled for schema fix
                // default_image_duration: defaultImageDuration, // Disabled for schema fix
                channel_info: channelInfo,

                keywords: keywords,
                // animation_prompts: animationPrompts // Disabled to fix schema cache error (column missing in DB)
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
    const [localImageDuration, setLocalImageDuration] = useState<string>((project.default_image_duration || 15).toString());
    const [localTitleFontSize, setLocalTitleFontSize] = useState<string>((overlayConfig.title?.fontSize || 60).toString());

    // Sync local state when props change (external updates)
    useEffect(() => {
        setLocalLoopCount((defaultLoopCount || 1).toString());
    }, [defaultLoopCount]);

    useEffect(() => {
        setLocalImageDuration((defaultImageDuration || 15).toString());
    }, [defaultImageDuration]);

    useEffect(() => {
        setLocalTitleFontSize((overlayConfig.title?.fontSize || 60).toString());
    }, [overlayConfig.title?.fontSize]);

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
                            { id: 'settings' as Tab, icon: Settings, label: 'Defaults' },
                            { id: 'templates' as Tab, icon: Type, label: 'Anim. Types' },
                            { id: 'overlays' as Tab, icon: Layers, label: 'Overlays' },
                            { id: 'general' as Tab, icon: Youtube, label: 'YouTube' },
                        ].map((tab) => (
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
                                <h3 className="text-lg font-semibold border-b border-border pb-2">Channel & Content (AI)</h3>
                                <div className="space-y-4 mb-8">
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Channel Info / Style</label>
                                        <textarea
                                            value={channelInfo}
                                            onChange={(e) => setChannelInfo(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none h-24 resize-none"
                                            placeholder="Describe your channel style, tone, and typical content (e.g. 'Chill Lofi Beats, relaxing atmosphere'). Used for AI generation."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Default Keywords</label>
                                        <input
                                            type="text"
                                            value={keywords}
                                            onChange={(e) => setKeywords(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Comma separated keywords (e.g. music, lofi, study)"
                                        />
                                    </div>
                                </div>

                                <h3 className="text-lg font-semibold border-b border-border pb-2">YouTube Credentials</h3>
                                <div className="space-y-4">
                                    {/* Existing Credentials */}
                                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-4">
                                        <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> Setup Instructions
                                        </h4>
                                        <ol className="list-decimal ml-4 text-xs text-muted-foreground space-y-1">
                                            <li>Go to <a href="https://console.cloud.google.com/" target="_blank" className="underline text-primary">Google Cloud Console</a> & create a project.</li>
                                            <li>Enable "YouTube Data API v3" in Library.</li>
                                            <li>Go to "Credentials" → "Create Credentials" → "OAuth Client ID".</li>
                                            <li>Choose "Web Application".</li>
                                            <li>
                                                Add Redirect URI: <code className="bg-black/20 px-1 rounded select-all">
                                                    https://makine-video-ai.vercel.app/api/auth/callback/youtube
                                                </code>
                                            </li>
                                            <li>Copy Client ID & Secret below.</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Client ID</label>
                                        <input
                                            type="text"
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Example: 123456789-abcdef...apps.googleusercontent.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Client Secret</label>
                                        <input
                                            type="password"
                                            value={clientSecret}
                                            onChange={(e) => setClientSecret(e.target.value)}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="Example: GOCSPX-..."
                                        />
                                    </div>

                                    {/* Connect Button */}
                                    <div className="pt-2">
                                        {refreshToken ? (
                                            <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                                <span className="text-sm font-medium">YouTube Connected</span>
                                                <button
                                                    onClick={() => setRefreshToken("")}
                                                    className="ml-auto text-xs text-muted hover:text-white underline"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={!clientId || !clientSecret}
                                                onClick={() => {
                                                    const url = `/api/auth/youtube?projectId=${project.id}&clientId=${clientId}&clientSecret=${clientSecret}`;
                                                    window.location.href = url;
                                                }}
                                                className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${clientId && clientSecret
                                                    ? 'bg-[#FF0000] hover:bg-[#CC0000] text-white shadow-lg shadow-red-900/20'
                                                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                                                    }`}
                                            >
                                                <Youtube className="w-4 h-4" />
                                                Connect YouTube Account
                                            </button>
                                        )}
                                        <p className="text-[10px] text-center text-muted mt-2">
                                            This will redirect you to Google to authorize the app.
                                        </p>
                                    </div>

                                    {/* Hidden manual refresh token input for debugging if needed */}
                                    {/* 
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
                                    */}
                                </div>
                            </div>
                        )}

                        {/* SETTINGS TAB (Was MODE) */}
                        {activeTab === 'settings' && (
                            <div className="space-y-6 max-w-xl">
                                <h3 className="text-lg font-semibold border-b border-border pb-2">Project Defaults</h3>

                                <div className="p-4 bg-card border border-border rounded-xl space-y-6">

                                    {/* Animation Loop Count */}
                                    <div>
                                        <label className="text-sm font-medium mb-1 flex items-center gap-2">
                                            <Repeat className="w-4 h-4 text-primary" />
                                            Default Animation Loop Count
                                        </label>
                                        <p className="text-xs text-muted mb-3">
                                            Each animation added to the playlist will loop this many times by default.
                                            (e.g. 2 means A, A, B, B...)
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={localLoopCount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setLocalLoopCount(val);
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

                                    <div className="border-t border-border" />

                                    {/* Image Duration */}
                                    <div>
                                        <label className="text-sm font-medium mb-1 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-primary" />
                                            Default Image Duration
                                        </label>
                                        <p className="text-xs text-muted mb-3">
                                            Each image added to the playlist will appear for this many seconds by default.
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={localImageDuration}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setLocalImageDuration(val);
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num) && num >= 1) {
                                                        setDefaultImageDuration(num);
                                                    }
                                                }}
                                                className="w-24 bg-background border border-border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                                min="1"
                                                step="0.5"
                                                placeholder="15"
                                            />
                                            <span className="text-sm text-muted">seconds</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                    <h4 className="font-semibold text-primary mb-1">Unified Mode</h4>
                                    <p className="text-xs text-muted-foreground">
                                        This project is set to Unified Mode. You can add both images and animations to the playlist on the homepage.
                                        The settings above define default values for new items. You can still edit individual items in the playlist.
                                    </p>
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
                                                                        const supabase = createClient();
                                                                        const fileExt = file.name.split('.').pop();
                                                                        const fileName = `fonts/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                                                                        let bucket = 'assets';
                                                                        let { error: upErr } = await supabase.storage.from(bucket).upload(fileName, file);

                                                                        if (upErr && (upErr.message.includes('not found') || (upErr as any).statusCode === 404)) {
                                                                            bucket = 'uploads';
                                                                            const { error: upErr2 } = await supabase.storage.from(bucket).upload(fileName, file);
                                                                            if (upErr2) throw upErr2;
                                                                        } else if (upErr) {
                                                                            throw upErr;
                                                                        }

                                                                        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

                                                                        const fontName = file.name.replace(/\.[^/.]+$/, "");
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
                                                {/* Styles and Position removed to enforce Modern look */}
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
                                                                        const formData = new FormData();
                                                                        formData.append('file', file);
                                                                        formData.append('project_id', project.id);

                                                                        const res = await fetch('/api/upload', {
                                                                            method: 'POST',
                                                                            body: formData
                                                                        });

                                                                        if (!res.ok) {
                                                                            const err = await res.json();
                                                                            throw new Error(err.error || 'Upload failed');
                                                                        }

                                                                        const data = await res.json();
                                                                        updateOverlayImage(index, 'url', data.url);
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
                                                {/* Visualizer Style selector removed - Enforcing Modern Clean Bar */}
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

                        {/* TEMPLATES TAB */}
                        {activeTab === 'templates' && (
                            <div className="space-y-6 max-w-2xl">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <h3 className="text-lg font-semibold">Animation Types</h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAnimationPrompts([...animationPrompts, {
                                                id: crypto.randomUUID(),
                                                name: 'New Type',
                                                prompt: 'Write a prompt for...'
                                            }]);
                                        }}
                                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Add Type
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {animationPrompts.map((prompt, index) => (
                                        <div key={prompt.id} className="p-4 bg-card border border-border rounded-xl space-y-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    value={prompt.name}
                                                    onChange={(e) => {
                                                        const newPrompts = [...animationPrompts];
                                                        newPrompts[index].name = e.target.value;
                                                        setAnimationPrompts(newPrompts);
                                                    }}
                                                    className="font-medium bg-transparent border-none focus:ring-0 p-0 text-foreground w-full"
                                                    placeholder="Type Name (e.g. Zoom In)"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!confirm('Delete this animation type?')) return;
                                                        const newPrompts = [...animationPrompts];
                                                        newPrompts.splice(index, 1);
                                                        setAnimationPrompts(newPrompts);
                                                    }}
                                                    className="text-muted hover:text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted block mb-1">System Prompt Template</label>
                                                <textarea
                                                    value={prompt.prompt}
                                                    onChange={(e) => {
                                                        const newPrompts = [...animationPrompts];
                                                        newPrompts[index].prompt = e.target.value;
                                                        setAnimationPrompts(newPrompts);
                                                    }}
                                                    className="w-full h-32 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                                    placeholder="Enter system prompt for AI..."
                                                />
                                                <p className="text-xs text-muted mt-1">
                                                    Use <code>{"{{user_prompt}}"}</code> to insert the user's input from the upload page.
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {animationPrompts.length === 0 && (
                                        <div className="text-center py-8 text-muted text-sm border-2 border-dashed border-border rounded-xl">
                                            No animation types defined. Add one to customize generation styles.
                                        </div>
                                    )}
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
                        className="btn-primary px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Settings
                    </button>
                </div>
            </div>
        </div >
    );
}
