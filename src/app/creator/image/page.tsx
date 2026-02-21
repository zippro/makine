'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { createClient } from '@/lib/supabase/client';
import {
    Sparkles, ImagePlus, Shuffle, Loader2, Download, ExternalLink,
    FolderOpen, Plus, ChevronRight, Check, AlertCircle, Wand2, X
} from 'lucide-react';

// ─── Size Presets (mirror server) ────────────────────────────────────────────

const SIZE_PRESETS = [
    { value: "square", label: "Square (1:1)" },
    { value: "square_hd", label: "Square HD (1:1)" },
    { value: "landscape_4_3", label: "Landscape (4:3)" },
    { value: "landscape_16_9", label: "Landscape (16:9)" },
    { value: "portrait_4_3", label: "Portrait (3:4)" },
    { value: "portrait_16_9", label: "Portrait (9:16)" },
];

const STRENGTH_OPTIONS = [
    { value: "low", label: "Low", desc: "Subtle changes" },
    { value: "medium", label: "Medium", desc: "Balanced variations" },
    { value: "high", label: "High", desc: "Strong variations" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImageAsset {
    id: string;
    url: string;
    filename: string;
    width: number;
    height: number;
    folder: string;
    source: string;
    generation_meta: any;
    created_at: string;
}

interface FolderItem {
    id: string;
    path: string;
    project_id: string;
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CreatorImagePage() {
    const { currentProject } = useProject();
    const [activeTab, setActiveTab] = useState<'t2i' | 'variations'>('t2i');

    // Shared state
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('/');
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [results, setResults] = useState<ImageAsset[]>([]);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // T2I state
    const [prompt, setPrompt] = useState('');
    const [imageSize, setImageSize] = useState('landscape_16_9');
    const [numImages, setNumImages] = useState(1);
    const [seed, setSeed] = useState('');

    // Variations state
    const [baseImage, setBaseImage] = useState<ImageAsset | null>(null);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [libraryImages, setLibraryImages] = useState<ImageAsset[]>([]);
    const [libraryFolder, setLibraryFolder] = useState('/');
    const [loadingLibrary, setLoadingLibrary] = useState(false);
    const [varStrength, setVarStrength] = useState('medium');
    const [varNumImages, setVarNumImages] = useState(1);
    const [varSeed, setVarSeed] = useState('');
    const [varImageSize, setVarImageSize] = useState('landscape_16_9');

    // ─── Fetch Folders ──────────────────────────────────────────────────

    const fetchFolders = useCallback(async () => {
        if (!currentProject) return;
        try {
            const res = await fetch(`/api/folders?projectId=${currentProject.id}`);
            const data = await res.json();
            if (Array.isArray(data)) setFolders(data);
        } catch { /* ignore */ }
    }, [currentProject]);

    useEffect(() => { fetchFolders(); }, [fetchFolders]);

    // ─── Create Folder ──────────────────────────────────────────────────

    const handleCreateFolder = async () => {
        if (!currentProject || !newFolderName.trim()) return;
        setCreatingFolder(true);
        try {
            const parentPath = selectedFolder === '/' ? '' : selectedFolder;
            const path = `${parentPath}/${newFolderName.trim()}`;
            const res = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: currentProject.id,
                    path,
                    skip_todo_list: true,
                }),
            });
            if (res.ok) {
                setSelectedFolder(path);
                setNewFolderName('');
                fetchFolders();
            }
        } finally {
            setCreatingFolder(false);
        }
    };

    // ─── Fetch Library Images (for variations) ──────────────────────────

    const fetchLibraryImages = useCallback(async (folder: string) => {
        if (!currentProject) return;
        setLoadingLibrary(true);
        try {
            const res = await fetch(`/api/images?projectId=${currentProject.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                const filtered = data.filter((img: ImageAsset) =>
                    (img.folder || '/') === folder
                );
                setLibraryImages(filtered);
            }
        } finally {
            setLoadingLibrary(false);
        }
    }, [currentProject]);

    useEffect(() => {
        if (showImagePicker) fetchLibraryImages(libraryFolder);
    }, [showImagePicker, libraryFolder, fetchLibraryImages]);

    // ─── Generate: Text to Image ────────────────────────────────────────

    const handleGenerateT2I = async () => {
        if (!currentProject || !prompt.trim()) return;
        setGenerating(true);
        setError(null);
        setResults([]);
        try {
            const res = await fetch('/api/creator/image/text-to-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    folder: selectedFolder,
                    prompt: prompt.trim(),
                    numImages,
                    imageSize,
                    seed: seed ? parseInt(seed) : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed');
            setResults(data.assets || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    // ─── Generate: Variations ───────────────────────────────────────────

    const handleGenerateVariations = async () => {
        if (!currentProject || !baseImage) return;
        setGenerating(true);
        setError(null);
        setResults([]);
        try {
            const res = await fetch('/api/creator/image/variations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    folder: selectedFolder,
                    baseImageId: baseImage.id,
                    numImages: varNumImages,
                    strength: varStrength,
                    seed: varSeed ? parseInt(varSeed) : undefined,
                    imageSize: varImageSize,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Variation failed');
            setResults(data.assets || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    // ─── No project guard ───────────────────────────────────────────────

    if (!currentProject) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted">Select a project to get started</p>
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Creator</h1>
                    <p className="text-sm text-muted">Generate images with AI</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-card rounded-xl border border-border">
                <button
                    onClick={() => { setActiveTab('t2i'); setResults([]); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 't2i'
                            ? 'bg-purple-500/15 text-purple-400 shadow-sm'
                            : 'text-muted hover:text-foreground hover:bg-card-hover'
                        }`}
                >
                    <Wand2 className="w-4 h-4" />
                    Text to Image
                </button>
                <button
                    onClick={() => { setActiveTab('variations'); setResults([]); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'variations'
                            ? 'bg-purple-500/15 text-purple-400 shadow-sm'
                            : 'text-muted hover:text-foreground hover:bg-card-hover'
                        }`}
                >
                    <Shuffle className="w-4 h-4" />
                    Image Variations
                </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Settings */}
                <div className="lg:col-span-1 space-y-5">
                    <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                        {activeTab === 't2i' ? (
                            <TextToImagePanel
                                prompt={prompt}
                                setPrompt={setPrompt}
                                imageSize={imageSize}
                                setImageSize={setImageSize}
                                numImages={numImages}
                                setNumImages={setNumImages}
                                seed={seed}
                                setSeed={setSeed}
                                generating={generating}
                                onGenerate={handleGenerateT2I}
                            />
                        ) : (
                            <VariationsPanel
                                baseImage={baseImage}
                                onSelectImage={() => setShowImagePicker(true)}
                                imageSize={varImageSize}
                                setImageSize={setVarImageSize}
                                numImages={varNumImages}
                                setNumImages={setVarNumImages}
                                strength={varStrength}
                                setStrength={setVarStrength}
                                seed={varSeed}
                                setSeed={setVarSeed}
                                generating={generating}
                                onGenerate={handleGenerateVariations}
                            />
                        )}

                        {/* Folder Selector */}
                        <div className="border-t border-border pt-4">
                            <label className="text-xs text-muted uppercase tracking-wide mb-2 block">
                                Save to Folder
                            </label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowFolderPicker(!showFolderPicker)}
                                    className="w-full flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border text-sm hover:border-purple-500/50 transition-colors"
                                >
                                    <FolderOpen className="w-4 h-4 text-muted" />
                                    <span className="flex-1 text-left truncate">
                                        {selectedFolder === '/' ? 'Root' : selectedFolder}
                                    </span>
                                    <ChevronRight className={`w-4 h-4 text-muted transition-transform ${showFolderPicker ? 'rotate-90' : ''}`} />
                                </button>

                                {showFolderPicker && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                                        <button
                                            onClick={() => { setSelectedFolder('/'); setShowFolderPicker(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-500/10 transition-colors ${selectedFolder === '/' ? 'text-purple-400' : ''}`}
                                        >
                                            <FolderOpen className="w-3.5 h-3.5" />
                                            Root
                                            {selectedFolder === '/' && <Check className="w-3.5 h-3.5 ml-auto" />}
                                        </button>
                                        {folders.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => { setSelectedFolder(f.path); setShowFolderPicker(false); }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-500/10 transition-colors ${selectedFolder === f.path ? 'text-purple-400' : ''}`}
                                            >
                                                <FolderOpen className="w-3.5 h-3.5" />
                                                <span className="truncate">{f.path}</span>
                                                {selectedFolder === f.path && <Check className="w-3.5 h-3.5 ml-auto" />}
                                            </button>
                                        ))}
                                        <div className="border-t border-border p-2">
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={newFolderName}
                                                    onChange={e => setNewFolderName(e.target.value)}
                                                    placeholder="New folder name..."
                                                    className="flex-1 text-xs px-2 py-1.5 bg-background border border-border rounded-md focus:outline-none focus:border-purple-500"
                                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                                />
                                                <button
                                                    onClick={handleCreateFolder}
                                                    disabled={creatingFolder || !newFolderName.trim()}
                                                    className="px-2 py-1.5 text-xs bg-purple-500/20 text-purple-400 rounded-md hover:bg-purple-500/30 disabled:opacity-50"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Results */}
                <div className="lg:col-span-2">
                    <ResultsPanel
                        results={results}
                        generating={generating}
                        error={error}
                        numImages={activeTab === 't2i' ? numImages : varNumImages}
                    />
                </div>
            </div>

            {/* Image Picker Modal */}
            {showImagePicker && (
                <ImagePickerModal
                    folders={folders}
                    images={libraryImages}
                    currentFolder={libraryFolder}
                    onFolderChange={setLibraryFolder}
                    loading={loadingLibrary}
                    onSelect={(img) => {
                        setBaseImage(img);
                        setSelectedFolder(img.folder || '/');
                        setShowImagePicker(false);
                    }}
                    onClose={() => setShowImagePicker(false)}
                />
            )}
        </div>
    );
}

// ─── Text to Image Panel ──────────────────────────────────────────────────────

function TextToImagePanel({
    prompt, setPrompt, imageSize, setImageSize,
    numImages, setNumImages, seed, setSeed,
    generating, onGenerate
}: any) {
    return (
        <>
            <div>
                <label className="text-xs text-muted uppercase tracking-wide mb-2 block">Prompt</label>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe the image you want to create..."
                    rows={4}
                    maxLength={2000}
                    className="w-full px-3 py-2.5 bg-background rounded-lg border border-border text-sm resize-none focus:outline-none focus:border-purple-500 transition-colors placeholder:text-muted/50"
                />
                <div className="text-right text-xs text-muted mt-1">{prompt.length}/2000</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-muted uppercase tracking-wide mb-1.5 block">Size</label>
                    <select
                        value={imageSize}
                        onChange={e => setImageSize(e.target.value)}
                        className="w-full px-3 py-2 bg-background rounded-lg border border-border text-sm focus:outline-none focus:border-purple-500"
                    >
                        {SIZE_PRESETS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-muted uppercase tracking-wide mb-1.5 block">Count</label>
                    <select
                        value={numImages}
                        onChange={e => setNumImages(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-background rounded-lg border border-border text-sm focus:outline-none focus:border-purple-500"
                    >
                        {[1, 2, 3, 4].map(n => (
                            <option key={n} value={n}>{n} image{n > 1 ? 's' : ''}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="text-xs text-muted uppercase tracking-wide mb-1.5 block">Seed (optional)</label>
                <input
                    type="number"
                    value={seed}
                    onChange={e => setSeed(e.target.value)}
                    placeholder="Random"
                    className="w-full px-3 py-2 bg-background rounded-lg border border-border text-sm focus:outline-none focus:border-purple-500"
                />
            </div>

            <button
                onClick={onGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                    <><Wand2 className="w-4 h-4" /> Generate</>
                )}
            </button>
        </>
    );
}

// ─── Variations Panel ─────────────────────────────────────────────────────────

function VariationsPanel({
    baseImage, onSelectImage, imageSize, setImageSize,
    numImages, setNumImages, strength, setStrength,
    seed, setSeed, generating, onGenerate
}: any) {
    return (
        <>
            <div>
                <label className="text-xs text-muted uppercase tracking-wide mb-2 block">Base Image</label>
                {baseImage ? (
                    <div className="relative group">
                        <img
                            src={baseImage.url}
                            alt="Base"
                            className="w-full h-40 object-cover rounded-lg border border-border"
                        />
                        <button
                            onClick={onSelectImage}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-sm text-white transition-opacity rounded-lg"
                        >
                            Change Image
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onSelectImage}
                        className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted hover:border-purple-500/50 hover:text-purple-400 transition-colors"
                    >
                        <ImagePlus className="w-6 h-6" />
                        <span className="text-sm">Select from Library</span>
                    </button>
                )}
            </div>

            <div>
                <label className="text-xs text-muted uppercase tracking-wide mb-2 block">Variation Strength</label>
                <div className="grid grid-cols-3 gap-2">
                    {STRENGTH_OPTIONS.map(s => (
                        <button
                            key={s.value}
                            onClick={() => setStrength(s.value)}
                            className={`px-3 py-2 rounded-lg text-xs text-center transition-all border ${strength === s.value
                                    ? 'bg-purple-500/15 border-purple-500/50 text-purple-400'
                                    : 'border-border text-muted hover:border-purple-500/30'
                                }`}
                        >
                            <div className="font-medium">{s.label}</div>
                            <div className="text-[10px] opacity-60 mt-0.5">{s.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-muted uppercase tracking-wide mb-1.5 block">Size</label>
                    <select
                        value={imageSize}
                        onChange={e => setImageSize(e.target.value)}
                        className="w-full px-3 py-2 bg-background rounded-lg border border-border text-sm focus:outline-none focus:border-purple-500"
                    >
                        {SIZE_PRESETS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-muted uppercase tracking-wide mb-1.5 block">Count</label>
                    <select
                        value={numImages}
                        onChange={e => setNumImages(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-background rounded-lg border border-border text-sm focus:outline-none focus:border-purple-500"
                    >
                        {[1, 2, 3, 4].map(n => (
                            <option key={n} value={n}>{n} variation{n > 1 ? 's' : ''}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="text-xs text-muted uppercase tracking-wide mb-1.5 block">Seed (optional)</label>
                <input
                    type="number"
                    value={seed}
                    onChange={e => setSeed(e.target.value)}
                    placeholder="Random"
                    className="w-full px-3 py-2 bg-background rounded-lg border border-border text-sm focus:outline-none focus:border-purple-500"
                />
            </div>

            <button
                onClick={onGenerate}
                disabled={generating || !baseImage}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                    <><Shuffle className="w-4 h-4" /> Generate Variations</>
                )}
            </button>
        </>
    );
}

// ─── Results Panel ────────────────────────────────────────────────────────────

function ResultsPanel({ results, generating, error, numImages }: {
    results: ImageAsset[]; generating: boolean; error: string | null; numImages: number;
}) {
    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-red-400">Generation Failed</p>
                    <p className="text-sm text-red-400/70 mt-1">{error}</p>
                </div>
            </div>
        );
    }

    if (generating) {
        return (
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: numImages }).map((_, i) => (
                    <div key={i} className="aspect-video bg-card rounded-xl border border-border overflow-hidden">
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-purple-400 animate-spin" style={{ animationDuration: '3s' }} />
                            </div>
                            <div className="text-sm text-muted">Generating image {i + 1}...</div>
                            <div className="w-32 h-1 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500/50 rounded-full animate-pulse" style={{ width: '60%' }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="bg-card rounded-xl border border-border p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/5 flex items-center justify-center mb-4">
                    <ImagePlus className="w-8 h-8 text-purple-500/30" />
                </div>
                <p className="text-muted text-sm">Generated images will appear here</p>
                <p className="text-muted/50 text-xs mt-1">Enter a prompt and click Generate</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted">
                    {results.length} image{results.length > 1 ? 's' : ''} generated
                </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {results.map(img => (
                    <div key={img.id} className="group relative bg-card rounded-xl border border-border overflow-hidden">
                        <img
                            src={img.url}
                            alt={img.filename}
                            className="w-full aspect-video object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                                <span className="text-xs text-white/70">
                                    {img.width}×{img.height}
                                </span>
                                <div className="flex gap-1.5">
                                    <a
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                                        title="View full size"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5 text-white" />
                                    </a>
                                    <a
                                        href={img.url}
                                        download={img.filename}
                                        className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                                        title="Download"
                                    >
                                        <Download className="w-3.5 h-3.5 text-white" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Image Picker Modal ──────────────────────────────────────────────────────

function ImagePickerModal({ folders, images, currentFolder, onFolderChange, loading, onSelect, onClose }: {
    folders: FolderItem[];
    images: ImageAsset[];
    currentFolder: string;
    onFolderChange: (f: string) => void;
    loading: boolean;
    onSelect: (img: ImageAsset) => void;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-semibold">Select Base Image</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-card-hover rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Folder Tabs */}
                <div className="flex gap-1 p-3 overflow-x-auto border-b border-border">
                    <button
                        onClick={() => onFolderChange('/')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${currentFolder === '/' ? 'bg-purple-500/15 text-purple-400' : 'text-muted hover:bg-card-hover'
                            }`}
                    >
                        Root
                    </button>
                    {folders.map(f => (
                        <button
                            key={f.id}
                            onClick={() => onFolderChange(f.path)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${currentFolder === f.path ? 'bg-purple-500/15 text-purple-400' : 'text-muted hover:bg-card-hover'
                                }`}
                        >
                            {f.path.split('/').pop()}
                        </button>
                    ))}
                </div>

                {/* Image Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                        </div>
                    ) : images.length === 0 ? (
                        <div className="text-center py-12 text-muted text-sm">
                            No images in this folder
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-3">
                            {images.map(img => (
                                <button
                                    key={img.id}
                                    onClick={() => onSelect(img)}
                                    className="group relative aspect-square rounded-lg border border-border overflow-hidden hover:border-purple-500/50 transition-colors"
                                >
                                    <img
                                        src={img.url}
                                        alt={img.filename}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-purple-600/0 group-hover:bg-purple-600/20 flex items-center justify-center transition-colors">
                                        <Check className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
