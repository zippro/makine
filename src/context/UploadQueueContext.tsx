"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Youtube, Minimize2, Upload } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadTask {
    id: string;
    jobId: string;
    title: string;
    status: "uploading" | "success" | "error";
    progress?: string;
    youtubeUrl?: string;
    error?: string;
    startedAt: number;
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

    const updateTask = useCallback((taskId: string, updates: Partial<UploadTask>) => {
        setUploads(prev => prev.map(u => u.id === taskId ? { ...u, ...updates } : u));
    }, []);

    const executeUpload = useCallback(async (task: UploadTask) => {
        const startTime = Date.now();

        // Show elapsed time in the toast
        const progressInterval = setInterval(() => {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const min = Math.floor(elapsed / 60);
            const sec = elapsed % 60;
            updateTask(task.id, {
                progress: `Uploading to YouTube... ${min > 0 ? min + 'm ' : ''}${sec}s`
            });
        }, 2000);

        try {
            updateTask(task.id, { progress: "Starting server-side upload..." });
            console.log("[Upload] Starting server-side upload for job:", task.jobId);

            // Use AbortController to handle timeouts
            const controller = new AbortController();

            const res = await fetch(`/api/jobs/${task.jobId}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task.metadata),
                signal: controller.signal,
            });

            clearInterval(progressInterval);

            // Parse response carefully
            let data: any;
            try {
                const text = await res.text();
                console.log("[Upload] Server response:", res.status, text.substring(0, 300));

                if (!text || text.trim().length === 0) {
                    throw new Error("Server returned empty response — the upload likely timed out. Check YouTube Studio to see if the video appeared.");
                }
                if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
                    throw new Error(
                        res.status === 504 ? "Server timed out — the video may still be uploading. Check YouTube Studio in a few minutes."
                            : `Server error (${res.status}). Try again.`
                    );
                }
                data = JSON.parse(text);
            } catch (parseErr: any) {
                if (!parseErr.message.includes("JSON")) throw parseErr;
                throw new Error("Server response was cut off — the upload may have timed out. Check YouTube Studio.");
            }

            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const min = Math.floor(elapsed / 60);
            const sec = elapsed % 60;
            console.log(`[Upload] ✅ Success! URL: ${data.url}`);

            updateTask(task.id, {
                status: "success",
                youtubeUrl: data.url,
                progress: `Published in ${min > 0 ? min + 'm ' : ''}${sec}s`
            });

        } catch (err: any) {
            clearInterval(progressInterval);
            console.error("[Upload] ❌ Error:", err.message);

            // Check if it's a timeout-like error
            const isTimeout = err.name === "AbortError" ||
                err.message?.includes("timed out") ||
                err.message?.includes("timeout") ||
                err.message?.includes("empty response");

            updateTask(task.id, {
                status: "error",
                error: isTimeout
                    ? "Upload timed out — but the video may still be processing on YouTube. Check YouTube Studio."
                    : err.message || "Upload failed"
            });
        }
    }, [updateTask]);

    const addUpload = useCallback((jobId: string, title: string, metadata: UploadTask["metadata"]) => {
        const task: UploadTask = {
            id: `${jobId}-${Date.now()}`,
            jobId,
            title,
            status: "uploading",
            startedAt: Date.now(),
            progress: "Starting...",
            metadata,
        };
        setUploads(prev => [...prev, task]);
        setMinimized(false);
        executeUpload(task);
    }, [executeUpload]);

    const retryUpload = useCallback((taskId: string) => {
        setUploads(prev => {
            const task = prev.find(u => u.id === taskId);
            if (!task) return prev;
            const updated = prev.map(u =>
                u.id === taskId
                    ? { ...u, status: "uploading" as const, error: undefined, progress: "Retrying...", startedAt: Date.now() }
                    : u
            );
            executeUpload({ ...task, status: "uploading", error: undefined, progress: "Retrying...", startedAt: Date.now() });
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
            {uploads.length > 0 && (
                <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 max-w-md w-full">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setMinimized(!minimized)}
                            className="p-1.5 bg-card border border-border rounded-lg text-muted hover:text-foreground transition-colors shadow-lg"
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
                        <UploadToast key={task.id} task={task} onRetry={() => retryUpload(task.id)} onDismiss={() => dismissUpload(task.id)} />
                    ))}
                </div>
            )}
        </UploadQueueContext.Provider>
    );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function UploadToast({ task, onRetry, onDismiss }: { task: UploadTask; onRetry: () => void; onDismiss: () => void }) {
    const borderColor = task.status === "uploading" ? "border-blue-500/30" : task.status === "success" ? "border-green-500/30" : "border-red-500/30";

    return (
        <div className={`bg-card border ${borderColor} rounded-xl p-4 shadow-xl animate-in slide-in-from-right-5 fade-in duration-300`}>
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${task.status === "success" ? "bg-green-500/10" : task.status === "error" ? "bg-red-500/10" : "bg-blue-500/10"
                        }`}>
                        {task.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {task.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                        {task.status === "uploading" && <Upload className="w-4 h-4 text-blue-500 animate-pulse" />}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.status === "uploading" && task.progress && (
                        <p className="text-xs text-blue-400 mt-0.5">{task.progress}</p>
                    )}
                    {task.status === "success" && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-green-400">{task.progress || "Published!"}</span>
                            {task.youtubeUrl && (
                                <a href={task.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                    Open <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    )}
                    {task.status === "error" && (
                        <div className="mt-1">
                            <p className="text-xs text-red-400 line-clamp-3">{task.error}</p>
                            <button onClick={onRetry} className="text-xs text-primary hover:underline mt-1">Retry</button>
                        </div>
                    )}
                </div>
                {task.status !== "uploading" && (
                    <button onClick={onDismiss} className="flex-shrink-0 p-1 text-muted hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
