"use client";

import { Loader2, Trash2, AlertCircle, Check } from 'lucide-react';

export interface UploadStatus {
    id: string;
    file: File;
    preview: string;
    status: 'pending' | 'uploading' | 'uploaded' | 'generating' | 'done' | 'error';
    url?: string;
    animationId?: string;
    error?: string;
}

interface UploadProgressProps {
    items: UploadStatus[];
    onRemove: (id: string) => void;
    onUpload: () => void;
    uploading: boolean;
}

export default function UploadProgress({ items, onRemove, onUpload, uploading }: UploadProgressProps) {
    if (items.length === 0) return null;

    const pendingCount = items.filter(img => img.status === 'pending').length;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">
                    {items.length} image{items.length !== 1 ? 's' : ''} selected
                </h2>
                <div className="flex gap-3">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="relative aspect-square rounded-xl overflow-hidden bg-card border border-border group"
                    >
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
                ))}
            </div>
        </div>
    );
}
