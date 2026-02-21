"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, CheckCircle, AlertCircle, Youtube, Minimize2, Upload, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadTask {
    id: string;
    jobId: string;
    title: string;
    status: "uploading" | "success" | "error";
    progress?: string;
    percent?: number;
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
    // Keep a ref to active abort controllers so we don't lose them on re-render
    const activeUploads = useRef<Map<string, AbortController>>(new Map());

    const updateTask = useCallback((taskId: string, updates: Partial<UploadTask>) => {
        setUploads(prev => prev.map(u => u.id === taskId ? { ...u, ...updates } : u));
    }, []);

    /**
     * Server-side upload: calls /api/jobs/[id]/publish
     * The server downloads the video from storage and streams it directly to YouTube.
     * No file is downloaded to the browser.
     */
    const executeUpload = useCallback(async (task: UploadTask) => {
        const startTime = Date.now();
        const controller = new AbortController();
        activeUploads.current.set(task.id, controller);

        try {
            updateTask(task.id, {
                progress: "Sending to YouTube (server-side)...",
                percent: 10
            });

            console.log(`[Upload] Starting server-side publish for job: ${task.jobId}`);

            // Call server-side publish endpoint
            // The server streams the video directly from storage to YouTube
            const res = await fetch(`/api/jobs/${task.jobId}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task.metadata),
                signal: controller.signal,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Server error (${res.status})`);
            }

            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const min = Math.floor(elapsed / 60);
            const sec = elapsed % 60;
            const statusLabel = data.status === 'scheduled' ? 'Scheduled' : 'Published';

            console.log(`[Upload] ✅ ${statusLabel}! URL: ${data.url} (${min}m ${sec}s)`);
            updateTask(task.id, {
                status: "success",
                youtubeUrl: data.url,
                progress: `${statusLabel} in ${min}m ${sec}s`,
                percent: 100,
            });

        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log(`[Upload] Cancelled: ${task.jobId}`);
                updateTask(task.id, {
                    status: "error",
                    error: "Upload cancelled",
                });
            } else {
                console.error("[Upload] ❌ FAILED:", err.message);
                updateTask(task.id, {
                    status: "error",
                    error: err.message || "Upload failed",
                });
            }
        } finally {
            activeUploads.current.delete(task.id);
        }
    }, [updateTask]);

    const addUpload = useCallback((jobId: string, title: string, metadata: UploadTask["metadata"]) => {
        const task: UploadTask = {
            id: `${jobId}-${Date.now()}`,
            jobId,
            title,
            status: "uploading",
            percent: 0,
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
                u.id === taskId ? { ...u, status: "uploading" as const, error: undefined, progress: "Retrying...", percent: 0 } : u
            );
            executeUpload({ ...task, status: "uploading", error: undefined, progress: "Retrying...", percent: 0 });
            return updated;
        });
    }, [executeUpload]);

    const dismissUpload = useCallback((taskId: string) => {
        // Cancel if still running
        const controller = activeUploads.current.get(taskId);
        if (controller) controller.abort();
        setUploads(prev => prev.filter(u => u.id !== taskId));
    }, []);

    const isUploading = useCallback((jobId: string) => {
        return uploads.some(u => u.jobId === jobId && u.status === "uploading");
    }, [uploads]);

    // Warn before closing tab if uploads are active
    useEffect(() => {
        const hasActive = uploads.some(u => u.status === "uploading");
        if (!hasActive) return;

        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "YouTube uploads are in progress. Are you sure you want to leave?";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [uploads]);

    // Portal mount
    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
    useEffect(() => {
        setPortalRoot(document.body);
    }, []);

    const toastPanel = uploads.length > 0 ? (
        <div
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxWidth: '420px',
                width: '100%',
                pointerEvents: 'auto',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setMinimized(!minimized)} className="p-1.5 bg-card border border-border rounded-lg text-muted hover:text-foreground transition-colors shadow-lg">
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
    ) : null;

    return (
        <UploadQueueContext.Provider value={{ uploads, addUpload, retryUpload, dismissUpload, isUploading }}>
            {children}
            {portalRoot && toastPanel && createPortal(toastPanel, portalRoot)}
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
                        {task.status === "uploading" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.status === "uploading" && (
                        <div className="mt-1.5">
                            <div className="w-full bg-border/50 rounded-full h-1.5 mb-1">
                                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 animate-pulse" style={{ width: '60%' }} />
                            </div>
                            <p className="text-xs text-blue-400">{task.progress}</p>
                            <p className="text-[10px] text-muted mt-0.5">Server uploading directly — you can navigate freely</p>
                        </div>
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
