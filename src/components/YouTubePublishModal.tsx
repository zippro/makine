
"use client";

import { useState, useEffect } from "react";
import { X, Youtube, Calendar, Clock, Tag, Type, AlignLeft, Globe, Lock, EyeOff } from "lucide-react";
import { VideoJob } from "@/lib/types";

interface YouTubePublishModalProps {
    job: VideoJob;
    isOpen: boolean;
    onClose: () => void;
    onPublish: (metadata: YouTubeMetadata) => Promise<void>;
}

export interface YouTubeMetadata {
    title: string;
    description: string;
    tags: string[];
    privacyStatus: "public" | "private" | "unlisted";
    publishAt?: string; // ISO string
}

export function YouTubePublishModal({ job, isOpen, onClose, onPublish }: YouTubePublishModalProps) {
    const [title, setTitle] = useState(job.title_text || "");
    const [description, setDescription] = useState(`Created with Makine Video AI\nProject: ${job.project_id}\n\n#shorts`);
    const [tags, setTags] = useState("music,video,ai,generated");
    const [privacyStatus, setPrivacyStatus] = useState<"public" | "private" | "unlisted">("private");
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduleDate, setScheduleDate] = useState("");
    const [scheduleTime, setScheduleTime] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Reset form when opening different job
    useEffect(() => {
        if (isOpen) {
            setTitle(job.title_text || "");
            const baseDesc = `Created with Makine Video AI\n\n#shorts`;
            setDescription(baseDesc);
            setError("");
        }
    }, [isOpen, job]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            let publishAt: string | undefined;

            if (isScheduled) {
                if (!scheduleDate || !scheduleTime) {
                    throw new Error("Please select both date and time for scheduling.");
                }
                const date = new Date(`${scheduleDate}T${scheduleTime}`);
                if (date <= new Date()) {
                    throw new Error("Schedule time must be in the future.");
                }
                publishAt = date.toISOString();
            }

            // Validating logic: If scheduled, must be private per YouTube API usually, 
            // but we will let the API handler enforce strictness or we enforce it here.
            // Generally for API: status.publishAt needs status.privacyStatus='private'.

            const finalPrivacy = isScheduled ? "private" : privacyStatus;

            await onPublish({
                title,
                description,
                tags: tags.split(",").map(t => t.trim()).filter(Boolean),
                privacyStatus: finalPrivacy,
                publishAt
            });
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Youtube className="w-6 h-6 text-red-600" />
                        Publish to YouTube
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <Type className="w-4 h-4" /> Video Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Enter video title..."
                            maxLength={100}
                            required
                        />
                        <div className="text-xs text-right text-muted">{title.length}/100</div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <AlignLeft className="w-4 h-4" /> Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 h-32 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                            placeholder="Tell viewers about your video..."
                        />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <Tag className="w-4 h-4" /> Tags (comma separated)
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="music, pop, AI, viral..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Visibility */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                <Globe className="w-4 h-4" /> Visibility
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setPrivacyStatus("public"); setIsScheduled(false); }}
                                    className={`p-3 rounded-lg border text-sm flex flex-col items-center gap-2 transition-all ${privacyStatus === "public" && !isScheduled
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    <Globe className="w-4 h-4" />
                                    Public
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setPrivacyStatus("unlisted"); setIsScheduled(false); }}
                                    className={`p-3 rounded-lg border text-sm flex flex-col items-center gap-2 transition-all ${privacyStatus === "unlisted" && !isScheduled
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    <EyeOff className="w-4 h-4" />
                                    Unlisted
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrivacyStatus("private")}
                                    className={`p-3 rounded-lg border text-sm flex flex-col items-center gap-2 transition-all ${((privacyStatus === "private") || isScheduled)
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    <Lock className="w-4 h-4" />
                                    Private
                                </button>
                            </div>
                        </div>

                        {/* Scheduling Toggle */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                <Calendar className="w-4 h-4" /> Schedule
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextState = !isScheduled;
                                    setIsScheduled(nextState);
                                    if (nextState) setPrivacyStatus("private");
                                }}
                                className={`w-full p-3 rounded-lg border text-sm flex items-center justify-center gap-2 transition-all ${isScheduled
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border hover:border-primary/50"
                                    }`}
                            >
                                <Clock className="w-4 h-4" />
                                {isScheduled ? "Scheduled" : "Publish Now"}
                            </button>
                        </div>
                    </div>

                    {/* Schedule Inputs */}
                    {isScheduled && (
                        <div className="p-4 bg-muted/30 rounded-xl border border-border animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                Schedule Publication
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted">Date</label>
                                    <input
                                        type="date"
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                                        required={isScheduled}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted">Time</label>
                                    <input
                                        type="time"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                                        required={isScheduled}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted mt-2">
                                Video will be set to <strong>Private</strong> until the scheduled time.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <div className="pt-2 sticky bottom-0 bg-card z-10 pb-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary py-4 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>Processing...</>
                            ) : (
                                <>
                                    <Youtube className="w-5 h-5" />
                                    {isScheduled ? "Scheule Upload" : "Upload to YouTube"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
