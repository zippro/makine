"use client";

import { useState } from 'react';
import { Loader2, Trash2, AlertCircle, Check, Sparkles } from 'lucide-react';

export interface UploadStatus {
    id: string;
    file: File;
    preview: string;
    status: 'pending' | 'uploading' | 'uploaded' | 'generating' | 'done' | 'error';
    url?: string;
    animationId?: string;
    error?: string;
    prompt?: string;
}

interface UploadProgressProps {
    items: UploadStatus[];
    onRemove: (id: string) => void;
    onUpload: () => void;
    onPromptChange: (id: string, prompt: string) => void;
    onGeneratePrompt?: (id: string, imageDataUrl: string) => Promise<string>;
    uploading: boolean;
}

export default function UploadProgress({ items, onRemove, onUpload, onPromptChange, onGeneratePrompt, uploading }: UploadProgressProps) {
    const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
    const [generatingAll, setGeneratingAll] = useState(false);

    if (items.length === 0) return null;

    const pendingItems = items.filter(img => img.status === 'pending');
    const pendingCount = pendingItems.length;

    const handleGenerateOne = async (item: UploadStatus) => {
        if (!onGeneratePrompt) return;
        setGeneratingIds(prev => new Set(prev).add(item.id));
        try {
            const prompt = await onGeneratePrompt(item.id, item.preview);
            onPromptChange(item.id, prompt);
        } catch (err) {
            console.error('Failed to generate prompt for', item.id, err);
        } finally {
            setGeneratingIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    const handleGenerateAll = async () => {
        if (!onGeneratePrompt) return;
        setGeneratingAll(true);
        const pending = items.filter(i => i.status === 'pending' && !i.prompt);
        for (const item of pending) {
            await handleGenerateOne(item);
        }
        setGeneratingAll(false);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">
                    {items.length} image{items.length !== 1 ? 's' : ''} selected
                </h2>
                <div className="flex gap-3">
                    {pendingCount > 0 && onGeneratePrompt && (
                        <button
                            onClick={handleGenerateAll}
                            disabled={uploading || generatingAll}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/20 text-sm font-medium transition-all disabled:opacity-50"
                        >
                            {generatingAll ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            {generatingAll ? 'Generating...' : `Generate All Prompts`}
                        </button>
                    )}
                    {pendingCount > 0 && (
                        <button
                            onClick={onUpload}
                            disabled={uploading}
                            className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    Generate Animations ({pendingCount})
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="relative rounded-xl overflow-hidden bg-card border border-border group flex flex-col"
                    >
                        <div className="aspect-square relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={item.preview}
                                alt={item.file.name}
                                className="w-full h-full object-cover"
                            />

                            {/* Status Overlay */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all ${item.status === 'pending' ? 'bg-transparent' :
                                item.status === 'error' ? 'bg-error/50' :
                                    item.status === 'done' ? 'bg-success/20' : 'bg-black/50'
                                }`}>
                                {item.status === 'uploading' && (
                                    <div className="text-white text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                        <p className="text-xs mt-1">Uploading...</p>
                                    </div>
                                )}
                                {item.status === 'generating' && (
                                    <div className="text-white text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                        <p className="text-xs mt-1">Generating...</p>
                                    </div>
                                )}
                                {item.status === 'done' && (
                                    <div className="text-success text-center">
                                        <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center mx-auto">
                                            <Check className="w-5 h-5 text-white" />
                                        </div>
                                        <p className="text-xs mt-1 text-white">Queued</p>
                                    </div>
                                )}
                                {item.status === 'error' && (
                                    <div className="text-white text-center p-2">
                                        <AlertCircle className="w-6 h-6 mx-auto" />
                                        <p className="text-xs mt-1 line-clamp-2">{item.error}</p>
                                    </div>
                                )}
                            </div>

                            {/* Remove Button */}
                            {item.status === 'pending' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove(item.id);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-error/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Prompt Input */}
                        {item.status === 'pending' && (
                            <div className="p-3 bg-card border-t border-border space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Prompt</span>
                                    {onGeneratePrompt && (
                                        <button
                                            onClick={() => handleGenerateOne(item)}
                                            disabled={generatingIds.has(item.id)}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-medium transition-all disabled:opacity-50"
                                        >
                                            {generatingIds.has(item.id) ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-3 h-3" />
                                            )}
                                            {generatingIds.has(item.id) ? 'AI...' : 'AI Generate'}
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
                                    placeholder="Describe how to animate this image, or click AI Generate..."
                                    rows={2}
                                    value={item.prompt || ''}
                                    onChange={(e) => onPromptChange(item.id, e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
