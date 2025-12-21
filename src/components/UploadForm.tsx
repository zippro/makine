'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Music, X, Loader2, Type } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UploadFormProps {
    onSubmit: (data: { imageUrl: string; audioUrl: string; title: string }) => Promise<void>;
    isLoading: boolean;
}

interface FileUploadProps {
    label: string;
    accept: string;
    icon: React.ReactNode;
    file: File | null;
    onFileChange: (file: File | null) => void;
    previewUrl?: string;
    disabled?: boolean;
}

function FileUpload({ label, accept, icon, file, onFileChange, previewUrl, disabled }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            onFileChange(droppedFile);
        }
    }, [onFileChange, disabled]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            onFileChange(selectedFile);
        }
    }, [onFileChange]);

    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onFileChange(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    }, [onFileChange]);

    return (
        <div
            className={`drop-zone relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all
        ${isDragging ? 'dragging border-primary bg-primary/10' : 'border-border hover:border-muted'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${file ? 'border-success bg-success/5' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled}
            />

            {file ? (
                <div className="flex flex-col items-center gap-3">
                    {previewUrl && accept.includes('image') && (
                        <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                        </div>
                    )}
                    {accept.includes('audio') && (
                        <audio src={previewUrl} controls className="max-w-full" />
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground truncate max-w-[200px]">
                            {file.name}
                        </span>
                        <button
                            onClick={handleRemove}
                            className="p-1 rounded-full hover:bg-error/20 text-error transition-colors"
                            disabled={disabled}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <span className="text-xs text-muted">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-card">
                        {icon}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted mt-1">
                            Drag & drop or click to browse
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export function UploadForm({ onSubmit, isLoading }: UploadFormProps) {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [imagePreview, setImagePreview] = useState<string>();
    const [audioPreview, setAudioPreview] = useState<string>();
    const [uploadProgress, setUploadProgress] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleImageChange = useCallback((file: File | null) => {
        setImageFile(file);
        setError('');
        if (file) {
            const url = URL.createObjectURL(file);
            setImagePreview(url);
        } else {
            setImagePreview(undefined);
        }
    }, []);

    const handleAudioChange = useCallback((file: File | null) => {
        setAudioFile(file);
        setError('');
        if (file) {
            const url = URL.createObjectURL(file);
            setAudioPreview(url);
        } else {
            setAudioPreview(undefined);
        }
    }, []);

    const validateForm = (): boolean => {
        if (!imageFile) {
            setError('Please upload an image');
            return false;
        }
        if (!audioFile) {
            setError('Please upload an audio file');
            return false;
        }
        if (!title.trim()) {
            setError('Please enter a video title');
            return false;
        }
        if (title.length > 100) {
            setError('Title must be less than 100 characters');
            return false;
        }
        // Validate file sizes
        if (imageFile.size > 10 * 1024 * 1024) {
            setError('Image must be less than 10MB');
            return false;
        }
        if (audioFile.size > 100 * 1024 * 1024) {
            setError('Audio must be less than 100MB');
            return false;
        }
        return true;
    };

    const uploadFile = async (file: File, bucket: string): Promise<string> => {
        const supabase = createClient();
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file);

        if (error) {
            throw new Error(`Failed to upload ${bucket}: ${error.message}`);
        }

        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        try {
            // Upload image
            setUploadProgress('Uploading image...');
            const imageUrl = await uploadFile(imageFile!, 'images');

            // Upload audio
            setUploadProgress('Uploading audio...');
            const audioUrl = await uploadFile(audioFile!, 'audio');

            // Create job
            setUploadProgress('Creating video job...');
            await onSubmit({ imageUrl, audioUrl, title: title.trim() });

            // Reset form on success
            setImageFile(null);
            setAudioFile(null);
            setTitle('');
            setImagePreview(undefined);
            setAudioPreview(undefined);
            setUploadProgress('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setUploadProgress('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload
                    label="Upload Image"
                    accept="image/jpeg,image/png,image/webp"
                    icon={<ImageIcon className="w-6 h-6 text-primary" />}
                    file={imageFile}
                    onFileChange={handleImageChange}
                    previewUrl={imagePreview}
                    disabled={isLoading}
                />

                <FileUpload
                    label="Upload Audio"
                    accept="audio/mpeg,audio/wav,audio/ogg"
                    icon={<Music className="w-6 h-6 text-primary" />}
                    file={audioFile}
                    onFileChange={handleAudioChange}
                    previewUrl={audioPreview}
                    disabled={isLoading}
                />
            </div>

            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Type className="w-4 h-4 text-primary" />
                    Video Title
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                        setTitle(e.target.value);
                        setError('');
                    }}
                    placeholder="Enter a title for your video..."
                    className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted"
                    maxLength={100}
                    disabled={isLoading}
                />
                <p className="text-xs text-muted text-right">{title.length}/100</p>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
                    {error}
                </div>
            )}

            {uploadProgress && (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 spinner" />
                    {uploadProgress}
                </div>
            )}

            <button
                type="submit"
                disabled={isLoading || !imageFile || !audioFile || !title.trim()}
                className="btn-primary w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 spinner" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Upload className="w-5 h-5" />
                        Generate Video
                    </>
                )}
            </button>
        </form>
    );
}
