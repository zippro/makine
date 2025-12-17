'use client';

import { useState } from 'react';
import { OverlayItem } from '@/lib/types';
import { Type, Image as ImageIcon, X, Layout, Clock, PlayCircle } from 'lucide-react';

interface OverlayEditorProps {
    items: OverlayItem[];
    onUpdate: (items: OverlayItem[]) => void;
}

const POSITIONS = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'center', label: 'Center' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-right', label: 'Bottom Right' },
] as const;

export function OverlayEditor({ items, onUpdate }: OverlayEditorProps) {
    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        onUpdate(newItems);
    };

    const updateItem = (index: number, updates: Partial<OverlayItem>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onUpdate(newItems);
    };

    const addTextOverlay = () => {
        onUpdate([
            ...items,
            {
                type: 'text',
                content: 'New Text',
                start: 0,
                duration: 5,
                position: 'center',
                font: 'Arial'
            }
        ]);
    };

    // Note: Image overlay upload would require handling file upload separately.
    // For now we assume a URL input or pre-handled upload.

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layout className="w-5 h-5" />
                    Overlays
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={addTextOverlay}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                    >
                        <Type className="w-4 h-4" />
                        Add Text
                    </button>
                    {/* Placeholder for Image Overlay */}
                    <button
                        onClick={() => alert('Image overlay requires file upload implementation')}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-card border border-border hover:bg-muted rounded-lg transition-colors"
                    >
                        <ImageIcon className="w-4 h-4" />
                        Add Image
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index} className="p-4 rounded-lg border border-border bg-card/50 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                                {/* Type & Content */}
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                        {item.type === 'text' ? <Type className="w-4 h-4 text-primary" /> : <ImageIcon className="w-4 h-4 text-primary" />}
                                    </div>
                                    {item.type === 'text' ? (
                                        <input
                                            type="text"
                                            value={item.content}
                                            onChange={(e) => updateItem(index, { content: e.target.value })}
                                            className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                                            placeholder="Enter text..."
                                        />
                                    ) : (
                                        <span className="text-sm text-muted break-all">{item.url}</span>
                                    )}
                                </div>

                                {/* Timing & Position Controls */}
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2 text-sm text-muted">
                                        <PlayCircle className="w-3 h-3" />
                                        <span>Start:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.start}
                                            onChange={(e) => updateItem(index, { start: parseFloat(e.target.value) || 0 })}
                                            className="w-16 bg-background border border-border rounded px-2 py-1 text-right focus:border-primary focus:outline-none"
                                        />
                                        <span>s</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-muted">
                                        <Clock className="w-3 h-3" />
                                        <span>Duration:</span>
                                        <input
                                            type="number"
                                            min="0.1"
                                            value={item.duration}
                                            onChange={(e) => updateItem(index, { duration: parseFloat(e.target.value) || 0 })}
                                            className="w-16 bg-background border border-border rounded px-2 py-1 text-right focus:border-primary focus:outline-none"
                                        />
                                        <span>s</span>
                                    </div>

                                    <select
                                        value={item.position}
                                        onChange={(e) => updateItem(index, { position: e.target.value as any })}
                                        className="bg-background border border-border rounded px-2 py-1 text-sm focus:border-primary focus:outline-none"
                                    >
                                        {POSITIONS.map(pos => (
                                            <option key={pos.id} value={pos.id}>{pos.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={() => removeItem(index)}
                                className="p-1.5 hover:bg-error/10 text-muted hover:text-error rounded transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
