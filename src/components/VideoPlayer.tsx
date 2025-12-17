'use client';

import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Maximize } from 'lucide-react';

interface VideoPlayerProps {
    src: string;
    title?: string;
    poster?: string;
}

export function VideoPlayer({ src, title, poster }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Early return if src is invalid
    if (!src) {
        return (
            <div className="rounded-xl overflow-hidden bg-card border border-border p-8 text-center">
                <p className="text-muted">No video available</p>
            </div>
        );
    }

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play().catch((err) => {
                    console.error('Play failed:', err);
                    setError('Unable to play video. The file may be unavailable.');
                });
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const toggleFullscreen = () => {
        if (videoRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                videoRef.current.requestFullscreen();
            }
        }
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = title ? `${title}.mp4` : 'video.mp4';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const formatTime = (time: number): string => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="rounded-xl overflow-hidden bg-card border border-border">
            {title && (
                <div className="p-4 border-b border-border">
                    <h3 className="font-semibold text-foreground truncate">{title}</h3>
                </div>
            )}

            <div className="video-container">
                {error ? (
                    <div className="w-full aspect-video flex items-center justify-center bg-error/10 text-error">
                        <p>{error}</p>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        src={src}
                        poster={poster}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        onError={() => setError('Unable to load video. The file may be unavailable or in an unsupported format.')}
                        className="w-full"
                        playsInline
                    />
                )}
            </div>

            <div className="p-4 space-y-3">
                {/* Progress bar */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted w-12">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <span className="text-xs text-muted w-12 text-right">{formatTime(duration)}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={togglePlay}
                            className="p-2 rounded-lg hover:bg-card-hover transition-colors"
                        >
                            {isPlaying ? (
                                <Pause className="w-5 h-5 text-foreground" />
                            ) : (
                                <Play className="w-5 h-5 text-foreground" />
                            )}
                        </button>
                        <button
                            onClick={toggleMute}
                            className="p-2 rounded-lg hover:bg-card-hover transition-colors"
                        >
                            {isMuted ? (
                                <VolumeX className="w-5 h-5 text-foreground" />
                            ) : (
                                <Volume2 className="w-5 h-5 text-foreground" />
                            )}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg hover:bg-card-hover transition-colors"
                        >
                            <Maximize className="w-5 h-5 text-foreground" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
