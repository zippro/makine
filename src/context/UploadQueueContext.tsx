"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, ExternalLink, CheckCircle, AlertCircle, Youtube, Minimize2, Upload } from "lucide-react";

// ─── Config ──────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB per chunk

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

    const updateTask = useCallback((taskId: string, updates: Partial<UploadTask>) => {
        setUploads(prev => prev.map(u => u.id === taskId ? { ...u, ...updates } : u));
    }, []);

    const executeUpload = useCallback(async (task: UploadTask) => {
        const startTime = Date.now();

        try {
            // ── Step 1: Create YouTube upload session ──
            updateTask(task.id, { progress: "Creating upload session...", percent: 0 });
            console.log("[Upload] Creating session for job:", task.jobId);

            const initRes = await fetch(`/api/jobs/${task.jobId}/publish-init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task.metadata),
            });

            const initText = await initRes.text();
            console.log("[Upload] Init response:", initRes.status, initText.substring(0, 200));

            if (!initRes.ok) {
                const err = initText ? JSON.parse(initText) : {};
                throw new Error(err.error || `Server error (${initRes.status})`);
            }

            const { uploadUrl, videoUrl, fileSize } = JSON.parse(initText);
            if (!uploadUrl) throw new Error("No upload URL returned");
            if (!videoUrl) throw new Error("No video URL returned");

            const totalMB = (fileSize / 1024 / 1024).toFixed(0);
            const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
            console.log(`[Upload] Session created. Video: ${totalMB} MB, ${totalChunks} chunks of ${CHUNK_SIZE / 1024 / 1024} MB`);

            // ── Step 2: Upload in chunks ──
            let bytesUploaded = 0;

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, fileSize) - 1;
                const chunkSize = end - start + 1;
                const pct = Math.round((start / fileSize) * 100);

                updateTask(task.id, {
                    progress: `Downloading chunk ${chunkIndex + 1}/${totalChunks} (${pct}%)`,
                    percent: pct,
                });
                console.log(`[Upload] Chunk ${chunkIndex + 1}/${totalChunks}: bytes ${start}-${end} (${(chunkSize / 1024 / 1024).toFixed(1)} MB)`);

                // Download this chunk from nginx using Range header
                const chunkRes = await fetch(videoUrl, {
                    headers: { "Range": `bytes=${start}-${end}` },
                });

                if (!chunkRes.ok && chunkRes.status !== 206) {
                    throw new Error(`Failed to download chunk ${chunkIndex + 1} (HTTP ${chunkRes.status})`);
                }

                const chunkBlob = await chunkRes.blob();
                console.log(`[Upload] Downloaded chunk: ${(chunkBlob.size / 1024 / 1024).toFixed(1)} MB`);

                // Upload this chunk to YouTube
                updateTask(task.id, {
                    progress: `Uploading chunk ${chunkIndex + 1}/${totalChunks} to YouTube (${pct}%)`,
                    percent: pct,
                });

                const isLastChunk = (chunkIndex === totalChunks - 1);
                const contentRange = `bytes ${start}-${end}/${fileSize}`;

                const uploadRes = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: {
                        "Content-Length": chunkSize.toString(),
                        "Content-Range": contentRange,
                        "Content-Type": "video/mp4",
                    },
                    body: chunkBlob,
                });

                bytesUploaded = end + 1;

                if (isLastChunk) {
                    // Last chunk: YouTube returns 200/201 with video data
                    if (uploadRes.ok) {
                        const ytData = await uploadRes.json();
                        const youtubeUrl = `https://youtu.be/${ytData.id}`;
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        const min = Math.floor(elapsed / 60);
                        const sec = elapsed % 60;

                        console.log(`[Upload] ✅ Complete! URL: ${youtubeUrl} (${min}m ${sec}s)`);
                        updateTask(task.id, {
                            status: "success",
                            youtubeUrl,
                            progress: `Published in ${min}m ${sec}s`,
                            percent: 100,
                        });
                        return;
                    } else {
                        const errText = await uploadRes.text();
                        console.error("[Upload] Final chunk error:", uploadRes.status, errText);
                        throw new Error(`YouTube rejected the final chunk (${uploadRes.status})`);
                    }
                } else {
                    // Non-last chunk: YouTube returns 308 Resume Incomplete
                    if (uploadRes.status === 308) {
                        const range = uploadRes.headers.get("range");
                        console.log(`[Upload] Chunk ${chunkIndex + 1} accepted. Range: ${range}`);
                    } else if (uploadRes.ok) {
                        // YouTube accepted early (smaller than expected)
                        const ytData = await uploadRes.json();
                        const youtubeUrl = `https://youtu.be/${ytData.id}`;
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        console.log(`[Upload] ✅ YouTube accepted early! URL: ${youtubeUrl}`);
                        updateTask(task.id, {
                            status: "success",
                            youtubeUrl,
                            progress: `Published in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`,
                            percent: 100,
                        });
                        return;
                    } else {
                        const errText = await uploadRes.text();
                        console.error("[Upload] Chunk upload error:", uploadRes.status, errText);
                        throw new Error(`YouTube rejected chunk ${chunkIndex + 1} (${uploadRes.status})`);
                    }
                }
            }

        } catch (err: any) {
            console.error("[Upload] ❌ FAILED:", err.message);
            console.error("[Upload] Full error:", err);
            updateTask(task.id, {
                status: "error",
                error: err.message || "Upload failed",
            });
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

                    {task.status === "uploading" && (
                        <div className="mt-1.5">
                            {/* Progress bar */}
                            <div className="w-full bg-border/50 rounded-full h-1.5 mb-1">
                                <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${task.percent || 0}%` }}
                                />
                            </div>
                            <p className="text-xs text-blue-400">{task.progress}</p>
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
