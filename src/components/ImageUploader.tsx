"use client";

import { Upload } from "lucide-react";
import { useCallback } from "react";

interface ImageUploaderProps {
    onFilesSelected: (files: File[]) => void;
    disabled?: boolean;
}

export default function ImageUploader({ onFilesSelected, disabled }: ImageUploaderProps) {
    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        onFilesSelected(files);
    }, [onFilesSelected, disabled]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        onFilesSelected(files);
    }, [onFilesSelected, disabled]);

    return (
        <div
            className={`p-8 rounded-xl border-2 border-dashed transition-all ${disabled
                    ? 'border-border opacity-50 cursor-not-allowed'
                    : 'border-border hover:border-primary cursor-pointer'
                }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => !disabled && document.getElementById('file-input')?.click()}
        >
            <input
                id="file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled}
            />
            <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                    <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                    <p className="font-medium text-foreground">
                        {disabled ? 'Select a project to upload' : 'Drop images here or click to browse'}
                    </p>
                    <p className="text-sm text-muted mt-1">Supports JPG, PNG, WebP</p>
                </div>
            </div>
        </div>
    );
}
