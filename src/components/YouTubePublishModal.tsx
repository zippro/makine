
"use client";

import { useState, useEffect } from "react";
import { X, Upload, Loader2, AlertCircle, CheckCircle, ExternalLink, Youtube, Type, AlignLeft, Tag, Globe, EyeOff, Lock, Calendar, Clock, Save } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { VideoJob } from "@/lib/types";
import { useUploadQueue } from "@/context/UploadQueueContext";
import { createClient } from "@/lib/supabase/client";

interface YouTubePublishModalProps {
    job: VideoJob;
    isOpen: boolean;
    onClose: () => void;
    channelInfo?: string;
    keywords?: string;
}

export interface YouTubeMetadata {
    title: string;
    description: string;
    tags: string[];
    privacyStatus: "public" | "private" | "unlisted";
    publishAt?: string; // ISO string
}

export default function YouTubePublishModal({ isOpen, onClose, job, channelInfo, keywords }: YouTubePublishModalProps) {
    useEscapeKey(onClose);
    const { addUpload, isUploading } = useUploadQueue();
    const [title, setTitle] = useState(job.title_text || "");
    const [description, setDescription] = useState(`Created with Makine Video AI\n\n#shorts`);
    const [tags, setTags] = useState("music,video,ai,generated");
    const [privacyStatus, setPrivacyStatus] = useState<"public" | "private" | "unlisted">("private");
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduleDate, setScheduleDate] = useState("");
    const [scheduleTime, setScheduleTime] = useState("");
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Reset form when opening different job — load saved draft if available
    useEffect(() => {
        if (isOpen) {
            const draft = (job as any).youtube_draft;
            if (draft) {
                setTitle(draft.title || job.title_text || "");
                setDescription(draft.description || `Created with Makine Video AI\n\n#shorts`);
                setTags(Array.isArray(draft.tags) ? draft.tags.join(", ") : draft.tags || "music,video,ai,generated");
                setPrivacyStatus(draft.privacyStatus || "private");
                if (draft.publishAt) {
                    setIsScheduled(true);
                    const d = new Date(draft.publishAt);
                    setScheduleDate(d.toISOString().split('T')[0]);
                    setScheduleTime(d.toTimeString().slice(0, 5));
                } else {
                    setIsScheduled(false);
                    setScheduleDate("");
                    setScheduleTime("");
                }
            } else {
                setTitle(job.title_text || "");
                setDescription(`Created with Makine Video AI\n\n#shorts`);
                setTags("music,video,ai,generated");
                setPrivacyStatus("private");
                setIsScheduled(false);
                setScheduleDate("");
                setScheduleTime("");
            }
            setError("");
            setSaveSuccess(false);
        }
    }, [isOpen, job]);

    const handleGenerateAI = async () => {
        setIsGeneratingAI(true);
        setError("");
        try {
            const res = await fetch("/api/ai/generate-metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel_info: channelInfo,
                    keywords: keywords,
                    video_title: title
                })
            });

            if (!res.ok) throw new Error("AI Generation Failed");

            const data = await res.json();
            setTitle(data.title);
            setDescription(data.description);
            setTags(data.tags);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to generate metadata");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // ─── Save Draft ──────────────────────────────────────────────────────────
    const handleSaveDraft = async () => {
        setIsSaving(true);
        setError("");
        setSaveSuccess(false);
        try {
            let publishAt: string | undefined;
            if (isScheduled && scheduleDate && scheduleTime) {
                publishAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
            }

            const draft = {
                title,
                description,
                tags: tags.split(",").map(t => t.trim()).filter(Boolean),
                privacyStatus: isScheduled ? "private" : privacyStatus,
                publishAt,
            };

            const supabase = createClient();
            const { error: updateError } = await supabase
                .from("video_jobs")
                .update({ youtube_draft: draft })
                .eq("id", job.id);

            if (updateError) throw updateError;

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err: any) {
            setError(err.message || "Failed to save draft");
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Publish (Background) ────────────────────────────────────────────────
    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

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

            const finalPrivacy = isScheduled ? "private" : privacyStatus;

            const metadata = {
                title,
                description,
                tags: tags.split(",").map(t => t.trim()).filter(Boolean),
                privacyStatus: finalPrivacy as "public" | "private" | "unlisted",
                publishAt,
            };

            // Save draft first
            const supabase = createClient();
            await supabase
                .from("video_jobs")
                .update({ youtube_draft: metadata })
                .eq("id", job.id);

            // Add to background upload queue — this closes the modal
            addUpload(job.id, title, metadata);
            onClose();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const jobIsUploading = isUploading(job.id);

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

                <div className="px-6 pt-4">
                    <button
                        type="button"
                        onClick={handleGenerateAI}
                        disabled={isGeneratingAI}
                        className="w-full py-3 bg-zinc-100 hover:bg-white text-black rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                    >
                        {isGeneratingAI ? (
                            <span className="flex items-center gap-2">Generating...</span>
                        ) : (
                            <>
                                <span className="text-lg">✨</span> Generate Metadata with AI
                            </>
                        )}
                    </button>
                    <p className="text-xs text-muted text-center mt-2">
                        Uses your project's Channel Info & Keywords to generate SEO-optimized content.
                    </p>
                </div>

                <form onSubmit={handlePublish} className="p-6 space-y-6">
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
                            placeholder="music, pop, lofi, chill..."
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

                    {saveSuccess && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-sm flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Draft saved!
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-2 sticky bottom-0 bg-card z-10 pb-2 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            {/* Save Draft Button */}
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={isSaving}
                                className="py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <>Saving...</>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save Draft
                                    </>
                                )}
                            </button>

                            {/* Upload Button */}
                            <button
                                type="submit"
                                disabled={jobIsUploading}
                                className="py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                            >
                                {jobIsUploading ? (
                                    <>Uploading...</>
                                ) : (
                                    <>
                                        <Youtube className="w-4 h-4" />
                                        {isScheduled ? "Schedule Upload" : "Upload to YouTube"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
