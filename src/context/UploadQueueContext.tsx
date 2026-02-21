"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { X, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Youtube, Minimize2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadTask {
    id: string;           // job ID
    jobId: string;
    title: string;        // video title for display
    status: "uploading" | "success" | "error";
    youtubeUrl?: string;
    error?: string;
    metadata: {
        title: string;
        description: string;
        tags: string[];
        privacyStatus: "public" | "private" | "unlisted";
        publishAt?: string;
    };
}

interface UploadQueueContextType {
    uploads: UploadTask[];
    addUpload: (jobId: string, title: string, metadata: UploadTask["metadata"]) => void;
    retryUpload: (taskId: string) => void;
    dismissUpload: (taskId: string) => void;
    isUploading: (jobId: string) => boolean;
}

const UploadQueueContext = createContext<UploadQueueContextType | null>(null);

export function useUploadQueue() {
    const ctx = useContext(UploadQueueContext);
    if (!ctx) throw new Error("useUploadQueue must be used within UploadQueueProvider");
    return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
    const [uploads, setUploads] = useState<UploadTask[]>([]);
    const [minimized, setMinimized] = useState(false);

    const executeUpload = useCallback(async (task: UploadTask) => {
        try {
            const res = await fetch(`/api/jobs/${task.jobId}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task.metadata),
            });

            // Try to parse JSON response — may fail on timeout/empty responses
            let data: any;
            try {
                const text = await res.text();
                if (!text || text.trim().length === 0) {
                    throw new Error("Empty response — the upload likely timed out. Try again or check if the video appeared on YouTube.");
                }
                // Check if response is HTML (Vercel error page)
                if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
                    throw new Error(
                        res.status === 504 || res.status === 502
                            ? "Upload timed out — the video is too large for the current server plan. Check YouTube Studio to see if it was partially uploaded."
                            : `Server error (${res.status}). Please try again.`
                    );
                }
                data = JSON.parse(text);
            } catch (parseErr: any) {
                // If it's our custom error, re-throw it
                if (parseErr.message && !parseErr.message.includes("JSON")) {
                    throw parseErr;
                }
                // JSON parse error — response was truncated
                throw new Error("Upload timed out — the server didn't respond in time. The video may still be uploading to YouTube. Check YouTube Studio.");
            }

            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            setUploads(prev =>
                prev.map(u =>
                    u.id === task.id
                        ? { ...u, status: "success" as const, youtubeUrl: data.url }
                        : u
                )
            );
        } catch (err: any) {
            setUploads(prev =>
                prev.map(u =>
                    u.id === task.id
                        ? { ...u, status: "error" as const, error: err.message || "Upload failed" }
                        : u
                )
            );
        }
    }, []);

    const addUpload = useCallback((jobId: string, title: string, metadata: UploadTask["metadata"]) => {
        const task: UploadTask = {
            id: `${jobId}-${Date.now()}`,
            jobId,
            title,
            status: "uploading",
            metadata,
        };

        setUploads(prev => [...prev, task]);
        setMinimized(false);

        // Fire and forget — runs in background
        executeUpload(task);
    }, [executeUpload]);

    const retryUpload = useCallback((taskId: string) => {
        setUploads(prev => {
            const task = prev.find(u => u.id === taskId);
            if (!task) return prev;

            const updated = prev.map(u =>
                u.id === taskId ? { ...u, status: "uploading" as const, error: undefined } : u
            );

            // Re-execute
            executeUpload({ ...task, status: "uploading", error: undefined });

            return updated;
        });
    }, [executeUpload]);

    const dismissUpload = useCallback((taskId: string) => {
        setUploads(prev => prev.filter(u => u.id !== taskId));
    }, []);

    const isUploading = useCallback((jobId: string) => {
        return uploads.some(u => u.jobId === jobId && u.status === "uploading");
    }, [uploads]);

    return (
        <UploadQueueContext.Provider value={{ uploads, addUpload, retryUpload, dismissUpload, isUploading }}>
            {children}

            {/* Floating Toast Panel */}
            {uploads.length > 0 && (
                <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 max-w-sm w-full">
                    {/* Minimize/Expand toggle */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setMinimized(!minimized)}
                            className="p-1.5 bg-card border border-border rounded-lg text-muted hover:text-foreground transition-colors shadow-lg"
                            title={minimized ? "Show uploads" : "Minimize"}
                        >
                            {minimized ? (
                                <div className="flex items-center gap-1.5 px-1">
                                    <Youtube className="w-3.5 h-3.5 text-red-500" />
                                    <span className="text-xs font-medium">{uploads.filter(u => u.status === "uploading").length} uploading</span>
                                </div>
                            ) : (
                                <Minimize2 className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>

                    {!minimized && uploads.map(task => (
                        <UploadToast
                            key={task.id}
                            task={task}
                            onRetry={() => retryUpload(task.id)}
                            onDismiss={() => dismissUpload(task.id)}
                        />
                    ))}
                </div>
            )}
        </UploadQueueContext.Provider>
    );
}

// ─── Toast Component ─────────────────────────────────────────────────────────

function UploadToast({
    task,
    onRetry,
    onDismiss,
}: {
    task: UploadTask;
    onRetry: () => void;
    onDismiss: () => void;
}) {
    const borderColor =
        task.status === "uploading" ? "border-blue-500/30" :
            task.status === "success" ? "border-green-500/30" :
                "border-red-500/30";

    const bgGlow =
        task.status === "uploading" ? "shadow-blue-500/5" :
            task.status === "success" ? "shadow-green-500/5" :
                "shadow-red-500/5";

    return (
        <div className={`bg-card border ${borderColor} rounded-xl p-4 shadow-xl ${bgGlow} animate-in slide-in-from-right-5 fade-in duration-300`}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                    {task.status === "uploading" && (
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                        </div>
                    )}
                    {task.status === "success" && (
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                    )}
                    {task.status === "error" && (
                        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>

                    {task.status === "uploading" && (
                        <p className="text-xs text-blue-400 mt-0.5">Uploading to YouTube...</p>
                    )}

                    {task.status === "success" && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-green-400">Published!</span>
                            {task.youtubeUrl && (
                                <a
                                    href={task.youtubeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                    Open <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    )}

                    {task.status === "error" && (
                        <div className="mt-1">
                            <p className="text-xs text-red-400 line-clamp-2">{task.error}</p>
                            <button
                                onClick={onRetry}
                                className="text-xs text-primary hover:underline mt-1"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </div>

                {/* Dismiss */}
                {task.status !== "uploading" && (
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 p-1 text-muted hover:text-foreground transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
