'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Music, Loader2, Trash2, Play, Pause, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useProject } from '@/context/ProjectContext';

interface MusicTrack {
    id: string;
    url: string;
    filename: string;
    file_size: number | null;
    duration_seconds: number | null;
    video_usage_count: number;
    created_at: string;
}

export default function MusicLibraryPage() {
    const [music, setMusic] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { currentProject } = useProject();

    const fetchMusic = useCallback(async () => {
        if (!currentProject) return;

        try {
            const response = await fetch(`/api/music?projectId=${currentProject.id}`);
            if (!response.ok) throw new Error('Failed to fetch music');
            const data = await response.json();
            setMusic(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentProject) {
            fetchMusic();
        } else {
            setMusic([]);
            setLoading(false);
        }
    }, [fetchMusic, currentProject]);

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        uploadFiles(files);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('audio/'));
        uploadFiles(files);
    }, []);

    const uploadFiles = async (files: File[]) => {
        if (files.length === 0) return;
        if (!currentProject) {
            setError("Please select a project first");
            return;
        }

        setUploading(true);
        setError(null);
        const supabase = createClient();

        for (const file of files) {
            try {
                // Upload to Supabase Storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('audio')
                    .upload(fileName, file, { cacheControl: '3600', upsert: false });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('audio')
                    .getPublicUrl(uploadData.path);

                // Get audio duration
                let duration: number | null = null;
                try {
                    duration = await getAudioDuration(file);
                } catch (err) {
                    console.error('Error getting audio duration:', err);
                }

                // Save to database
                const response = await fetch('/api/music', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: publicUrl,
                        filename: file.name,
                        file_size: file.size,
                        duration_seconds: duration,
                        project_id: currentProject.id,
                    }),
                });

                if (!response.ok) throw new Error('Failed to save music');

            } catch (err) {
                console.error('Error uploading music:', err);
                setError(`Failed to upload ${file.name}: ${(err as Error).message}`);
            }
        }

        setUploading(false);
        fetchMusic();
    };

    const getAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
            };
            audio.onerror = () => {
                reject(new Error('Failed to load audio'));
            };
            audio.src = URL.createObjectURL(file);
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this music track?')) return;

        setDeletingId(id);
        try {
            const response = await fetch(`/api/music?id=${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete');
            await fetchMusic();
        } catch (err) {
            console.error('Error deleting:', err);
            setError((err as Error).message);
        } finally {
            setDeletingId(null);
        }
    };

    const togglePlay = (track: MusicTrack) => {
        if (playingId === track.id) {
            audioRef.current?.pause();
            setPlayingId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.src = track.url;
                audioRef.current.play();
            }
            setPlayingId(track.id);
        }
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '--';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Hidden audio element for playback */}
            <audio
                ref={audioRef}
                onEnded={() => setPlayingId(null)}
                className="hidden"
            />

            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">Music Library</h1>
                    <p className="text-muted mt-2">
                        {currentProject ? `Project: ${currentProject.name}` : 'Select a project to manage music'}
                    </p>
                    <p className="text-muted mt-1">
                        {music.length} track{music.length !== 1 ? 's' : ''} in library
                    </p>
                </div>

                {/* Drop Zone */}
                <div
                    className="mb-6 p-8 rounded-xl border-2 border-dashed border-border hover:border-primary transition-all cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById('music-input')?.click()}
                >
                    <input
                        id="music-input"
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                    />
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 rounded-full bg-primary/10">
                            {uploading ? (
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            ) : (
                                <Upload className="w-8 h-8 text-primary" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-foreground">
                                {uploading ? 'Uploading...' : 'Drop music files here or click to browse'}
                            </p>
                            <p className="text-sm text-muted mt-1">Supports MP3, WAV, OGG</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error mb-6">
                        {error}
                    </div>
                )}

                {/* Music List */}
                {music.length === 0 ? (
                    <div className="text-center py-16">
                        <Music className="w-16 h-16 text-muted mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-foreground">No music yet</h2>
                        <p className="text-muted mt-2">Upload music files to get started</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {music.map((track) => (
                            <div
                                key={track.id}
                                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
                            >
                                {/* Play Button */}
                                <button
                                    onClick={() => togglePlay(track)}
                                    className="p-3 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                                >
                                    {playingId === track.id ? (
                                        <Pause className="w-5 h-5" />
                                    ) : (
                                        <Play className="w-5 h-5" />
                                    )}
                                </button>

                                {/* Track Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{track.filename}</p>
                                    <div className="flex items-center gap-4 text-sm text-muted mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDuration(track.duration_seconds)}
                                        </span>
                                        <span>{formatFileSize(track.file_size)}</span>
                                        {track.video_usage_count > 0 && (
                                            <span className="text-primary">
                                                Used in {track.video_usage_count} video{track.video_usage_count !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={() => handleDelete(track.id)}
                                    disabled={deletingId === track.id}
                                    className="p-2 rounded-lg text-error hover:bg-error/10 transition-all disabled:opacity-50"
                                >
                                    {deletingId === track.id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
