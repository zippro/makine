"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, CheckCircle, AlertCircle, Youtube, Minimize2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
            // ── Step 1: Get access token + video info from server ──
            updateTask(task.id, { progress: "Getting credentials...", percent: 0 });
            console.log("[Upload] Step 1: Getting access token for job:", task.jobId);

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

            const { accessToken, videoUrl, fileSize } = JSON.parse(initText);
            if (!accessToken) throw new Error("No access token returned");
            if (!videoUrl) throw new Error("No video URL returned");

            const totalMB = (fileSize / 1024 / 1024).toFixed(0);
            console.log(`[Upload] Got token. Video: ${totalMB} MB at ${videoUrl.substring(0, 60)}`);

            // ── Step 2: Create YouTube upload session FROM THE BROWSER ──
            // This ensures Google includes CORS headers on the upload URI
            updateTask(task.id, { progress: "Creating YouTube session...", percent: 0 });
            console.log("[Upload] Step 2: Creating YouTube upload session from browser...");

            const title = task.metadata.title || "My Video";
            const description = task.metadata.description || "";
            const tags = task.metadata.tags || [];
            const privacyStatus = task.metadata.privacyStatus || "private";

            const ytMetadata: any = {
                snippet: {
                    title: title.substring(0, 100),
                    description,
                    tags,
                    categoryId: "22",
                },
                status: {
                    privacyStatus,
                    selfDeclaredMadeForKids: false,
                },
            };
            if (task.metadata.publishAt) {
                ytMetadata.status.publishAt = task.metadata.publishAt;
            }

            const initHeaders: Record<string, string> = {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
            };
            if (fileSize > 0) {
                initHeaders["X-Upload-Content-Length"] = fileSize.toString();
            }

            const sessionRes = await fetch(
                "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                {
                    method: "POST",
                    headers: initHeaders,
                    body: JSON.stringify(ytMetadata),
                }
            );

            if (!sessionRes.ok) {
                const errText = await sessionRes.text();
                console.error("[Upload] YouTube session creation failed:", sessionRes.status, errText);
                try {
                    const errData = JSON.parse(errText);
                    const msg = errData?.error?.message || errData?.error?.errors?.[0]?.message || errText;
                    throw new Error(`YouTube error: ${msg}`);
                } catch (e: any) {
                    if (e.message.startsWith("YouTube error:")) throw e;
                    throw new Error(`YouTube rejected session (${sessionRes.status})`);
                }
            }

            const uploadUrl = sessionRes.headers.get("location");
            if (!uploadUrl) throw new Error("YouTube did not return an upload URL");

            console.log("[Upload] YouTube session created! Upload URL obtained.");

            // ── Step 3: Upload in chunks ──
            const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
            console.log(`[Upload] Starting chunked upload: ${totalChunks} chunks of ${CHUNK_SIZE / 1024 / 1024} MB`);

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, fileSize) - 1;
                const chunkSize = end - start + 1;
                const overallPct = Math.round((start / fileSize) * 100);

                // Download chunk from nginx
                updateTask(task.id, {
                    progress: `Chunk ${chunkIndex + 1}/${totalChunks}: downloading... (${overallPct}%)`,
                    percent: overallPct,
                });
                console.log(`[Upload] Chunk ${chunkIndex + 1}/${totalChunks}: downloading bytes ${start}-${end}`);

                const chunkRes = await fetch(videoUrl, {
                    headers: { "Range": `bytes=${start}-${end}` },
                });

                if (!chunkRes.ok && chunkRes.status !== 206) {
                    throw new Error(`Failed to download chunk ${chunkIndex + 1} (HTTP ${chunkRes.status})`);
                }

                const chunkBlob = await chunkRes.blob();
                console.log(`[Upload] Chunk downloaded: ${(chunkBlob.size / 1024 / 1024).toFixed(1)} MB`);

                // Upload chunk to YouTube
                updateTask(task.id, {
                    progress: `Chunk ${chunkIndex + 1}/${totalChunks}: uploading to YouTube... (${overallPct}%)`,
                    percent: overallPct,
                });

                const contentRange = `bytes ${start}-${end}/${fileSize}`;
                console.log(`[Upload] Uploading chunk to YouTube: ${contentRange}`);

                const uploadRes = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Range": contentRange,
                        "Content-Type": "video/mp4",
                    },
                    body: chunkBlob,
                });

                console.log(`[Upload] YouTube response: ${uploadRes.status}`);

                if (uploadRes.status === 200 || uploadRes.status === 201) {
                    // Upload complete!
                    const ytData = await uploadRes.json();
                    const youtubeUrl = `https://youtu.be/${ytData.id}`;
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    const min = Math.floor(elapsed / 60);
                    const sec = elapsed % 60;

                    // Update youtube_status in DB
                    const supabase = createClient();
                    const ytStatus = task.metadata.publishAt ? 'scheduled' : 'published';
                    const updateData: any = {
                        youtube_status: ytStatus,
                        youtube_id: ytData.id,
                    };
                    if (task.metadata.publishAt) {
                        updateData.youtube_scheduled_at = task.metadata.publishAt;
                    }
                    const { error: dbError } = await supabase
                        .from('video_jobs')
                        .update(updateData)
                        .eq('id', task.jobId);

                    if (dbError) {
                        console.error('[Upload] DB update error:', dbError);
                    }

                    console.log(`[Upload] ✅ Complete! URL: ${youtubeUrl} (${min}m ${sec}s), status: ${ytStatus}`);
                    updateTask(task.id, {
                        status: "success",
                        youtubeUrl,
                        progress: `Published in ${min}m ${sec}s`,
                        percent: 100,
                    });
                    return;
                } else if (uploadRes.status === 308) {
                    // Chunk accepted, more to go
                    const range = uploadRes.headers.get("range");
                    console.log(`[Upload] Chunk ${chunkIndex + 1} accepted. Server range: ${range}`);
                } else {
                    // Error
                    const errText = await uploadRes.text();
                    console.error(`[Upload] Chunk ${chunkIndex + 1} error:`, uploadRes.status, errText);
                    try {
                        const errData = JSON.parse(errText);
                        const msg = errData?.error?.message || `YouTube error (${uploadRes.status})`;
                        throw new Error(msg);
                    } catch (e: any) {
                        if (e.message.includes("YouTube")) throw e;
                        throw new Error(`Upload failed at chunk ${chunkIndex + 1} (${uploadRes.status})`);
                    }
                }
            }

            // If we exit the loop without success, something went wrong
            throw new Error("Upload completed all chunks but YouTube didn't confirm. Check YouTube Studio.");

        } catch (err: any) {
            console.error("[Upload] ❌ FAILED:", err.message);
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

    // Portal mount — render toast directly on document.body to bypass CSS transform issues
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
                        {task.status === "uploading" && <Upload className="w-4 h-4 text-blue-500 animate-pulse" />}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.status === "uploading" && (
                        <div className="mt-1.5">
                            <div className="w-full bg-border/50 rounded-full h-1.5 mb-1">
                                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${task.percent || 0}%` }} />
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
