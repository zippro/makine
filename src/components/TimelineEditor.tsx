'use client';

import { useState } from 'react';
import { TimelineItem } from '@/lib/types';
import { GripVertical, X, Clock, Repeat, ImageIcon, Film } from 'lucide-react';

interface TimelineEditorProps {
    items: TimelineItem[];
    onUpdate: (items: TimelineItem[]) => void;
}

export function TimelineEditor({ items, onUpdate }: TimelineEditorProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newItems = [...items];
        const draggedItem = newItems[draggedIndex];
        newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);

        onUpdate(newItems);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        onUpdate(newItems);
    };

    const updateItem = (index: number, updates: Partial<TimelineItem>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onUpdate(newItems);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <Film className="w-5 h-5" />
                Valid Timeline
            </h3>

            <div className="space-y-2">
                {items.map((item, index) => (
                    <div
                        key={index}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`
                            flex items-center gap-4 p-4 rounded-lg border bg-card/50 
                            ${draggedIndex === index ? 'opacity-50 border-primary border-dashed' : 'border-border'}
                            hover:border-primary/50 transition-colors cursor-move
                        `}
                    >
                        <GripVertical className="w-5 h-5 text-muted shrink-0" />

                        {/* Icon based on type */}
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            {item.type === 'animation' ? (
                                <Repeat className="w-5 h-5 text-primary" />
                            ) : (
                                <ImageIcon className="w-5 h-5 text-primary" />
                            )}
                        </div>

                        {/* Content Info */}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                                {item.type === 'animation' ? 'Animation Sequence' : 'Image Slide'}
                            </p>
                            <p className="text-xs text-muted truncate">
                                {item.id || item.url?.slice(-20)}
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-background/50 px-2 py-1 rounded border border-border">
                                <Clock className="w-3 h-3 text-muted" />
                                <input
                                    type="number"
                                    min="1"
                                    value={item.duration}
                                    onChange={(e) => updateItem(index, { duration: parseInt(e.target.value) || 5 })}
                                    className="w-12 bg-transparent text-sm text-right focus:outline-none"
                                />
                                <span className="text-xs text-muted">sec</span>
                            </div>

                            {item.type === 'animation' && (
                                <button
                                    onClick={() => updateItem(index, { loop: !item.loop })}
                                    className={`
                                        p-1.5 rounded transition-colors
                                        ${item.loop ? 'bg-primary/20 text-primary' : 'bg-background hover:bg-muted text-muted'}
                                    `}
                                    title="Loop Animation"
                                >
                                    <Repeat className="w-4 h-4" />
                                </button>
                            )}

                            <button
                                onClick={() => removeItem(index)}
                                className="p-1.5 hover:bg-error/10 text-muted hover:text-error rounded transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="text-center p-8 border-2 border-dashed border-border rounded-xl text-muted">
                        <p>No items in timeline.</p>
                        <p className="text-sm">Select animations or images to add them here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
