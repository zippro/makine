"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Youtube, Minimize2, Download, Upload } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadStep = "init" | "downloading" | "uploading" | "done" | "error";

export interface UploadTask {
    id: string;
    jobId: string;
    title: string;
    status: "uploading" | "success" | "error";
    step: UploadStep;
    progress?: string;   // Human-readable progress e.g. "Downloading 538 MB..."
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

    // Helper to update a single task
    const updateTask = useCallback((taskId: string, updates: Partial<UploadTask>) => {
        setUploads(prev => prev.map(u => u.id === taskId ? { ...u, ...updates } : u));
    }, []);

    const executeUpload = useCallback(async (task: UploadTask) => {
        try {
            // ── Step 1: Get resumable upload URL ──
            updateTask(task.id, { step: "init", progress: "Creating upload session..." });
            console.log("[Upload] Step 1: Creating upload session for job", task.jobId);

            const initRes = await fetch(`/api/jobs/${task.jobId}/publish-init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task.metadata),
            });

            let initData: any;
            try {
                const text = await initRes.text();
                console.log("[Upload] Step 1 response:", initRes.status, text.substring(0, 200));
                initData = text ? JSON.parse(text) : {};
            } catch {
                throw new Error("Server error — could not create upload session.");
            }

            if (!initRes.ok) {
                throw new Error(initData.error || "Failed to create upload session");
            }

            const { uploadUrl, videoUrl } = initData;
            if (!uploadUrl || !videoUrl) {
                throw new Error("Missing upload URL or video URL from server");
            }

            console.log("[Upload] Step 1 complete. Upload URL obtained.");
            console.log("[Upload] Video source:", videoUrl.substring(0, 80));

            // ── Step 2: Download video in browser ──
            updateTask(task.id, { step: "downloading", progress: "Downloading video..." });
            console.log("[Upload] Step 2: Downloading video...");

            const videoRes = await fetch(videoUrl);
            if (!videoRes.ok) {
                throw new Error(`Failed to download video (HTTP ${videoRes.status}). Is the video server online?`);
            }

            const videoBlob = await videoRes.blob();
            const sizeMB = (videoBlob.size / 1024 / 1024).toFixed(0);
            console.log(`[Upload] Step 2 complete. Downloaded ${sizeMB} MB`);

            // ── Step 3: Upload to YouTube ──
            updateTask(task.id, { step: "uploading", progress: `Uploading ${sizeMB} MB to YouTube...` });
            console.log(`[Upload] Step 3: Uploading ${sizeMB} MB to YouTube...`);

            const uploadStartTime = Date.now();

            // Use XMLHttpRequest for upload progress tracking
            const ytResult = await new Promise<{ id: string }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadUrl, true);
                xhr.setRequestHeader("Content-Type", "video/mp4");

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        const uploadedMB = (e.loaded / 1024 / 1024).toFixed(0);
                        updateTask(task.id, {
                            progress: `Uploading to YouTube: ${pct}% (${uploadedMB}/${sizeMB} MB)`
                        });
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch {
                            // YouTube might return non-JSON on success (unlikely but handle it)
                            console.log("[Upload] YouTube response:", xhr.responseText.substring(0, 200));
                            reject(new Error("YouTube returned invalid response. Check YouTube Studio — the video may have uploaded."));
                        }
                    } else {
                        console.error("[Upload] YouTube error:", xhr.status, xhr.responseText.substring(0, 300));
                        reject(new Error(`YouTube rejected the upload (${xhr.status}). Try again.`));
                    }
                };

                xhr.onerror = () => {
                    console.error("[Upload] XHR network error");
                    reject(new Error("Network error during YouTube upload. Check your internet connection."));
                };

                xhr.ontimeout = () => {
                    reject(new Error("YouTube upload timed out."));
                };

                xhr.send(videoBlob);
            });

            const elapsed = ((Date.now() - uploadStartTime) / 1000).toFixed(0);
            const youtubeUrl = `https://youtu.be/${ytResult.id}`;
            console.log(`[Upload] Step 3 complete! Uploaded in ${elapsed}s. URL: ${youtubeUrl}`);

            updateTask(task.id, {
                status: "success",
                step: "done",
                youtubeUrl,
                progress: `Published in ${elapsed}s`
            });

        } catch (err: any) {
            console.error("[Upload] FAILED:", err.message);
            console.error("[Upload] Full error:", err);
            updateTask(task.id, {
                status: "error",
                step: "error",
                error: err.message || "Upload failed"
            });
        }
    }, [updateTask]);

    const addUpload = useCallback((jobId: string, title: string, metadata: UploadTask["metadata"]) => {
        const task: UploadTask = {
            id: `${jobId}-${Date.now()}`,
            jobId,
            title,
            status: "uploading",
            step: "init",
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
                    ? { ...u, status: "uploading" as const, step: "init" as const, error: undefined, progress: "Retrying..." }
                    : u
            );

            executeUpload({ ...task, status: "uploading", step: "init", error: undefined, progress: "Retrying..." });
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
                <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 max-w-md w-full">
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

    // Step icon
    const StepIcon = () => {
        if (task.status === "success") return <CheckCircle className="w-4 h-4 text-green-500" />;
        if (task.status === "error") return <AlertCircle className="w-4 h-4 text-red-500" />;
        if (task.step === "downloading") return <Download className="w-4 h-4 text-blue-500 animate-bounce" />;
        if (task.step === "uploading") return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />;
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    };

    return (
        <div className={`bg-card border ${borderColor} rounded-xl p-4 shadow-xl ${bgGlow} animate-in slide-in-from-right-5 fade-in duration-300`}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${task.status === "success" ? "bg-green-500/10" :
                            task.status === "error" ? "bg-red-500/10" :
                                "bg-blue-500/10"
                        }`}>
                        <StepIcon />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>

                    {task.status === "uploading" && task.progress && (
                        <p className="text-xs text-blue-400 mt-0.5">{task.progress}</p>
                    )}

                    {task.status === "success" && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-green-400">{task.progress || "Published!"}</span>
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
