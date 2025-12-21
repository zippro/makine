"use client";

import { useState } from "react";
import { X, Sparkles, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface VideoDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    video: any;
    project: any;
    onUpdate: (updatedVideo: any) => void;
}

export function VideoDetailsModal({ isOpen, onClose, video, project, onUpdate }: VideoDetailsModalProps) {
    const [title, setTitle] = useState(video?.youtube_title || video?.title_text || "");
    const [description, setDescription] = useState(video?.youtube_description || "");
    const [tags, setTags] = useState(video?.youtube_tags ? video.youtube_tags.join(", ") : "");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen || !video) return null;

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        setError("");
        try {
            const res = await fetch("/api/ai/generate-metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image_url: video.thumbnail_url || video.image_url, // Fallback to source image if thumb missing
                    channel_info: project.channel_info,
                    keywords: project.keywords
                })
            });

            if (!res.ok) throw new Error("AI Generation Failed");

            const data = await res.json();
            setTitle(data.title);
            setDescription(data.description);
            setTags(data.tags); // API returns string "tag1, tag2"
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to generate metadata");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const supabase = createClient();

            // Convert tags string to array
            const tagsArray = tags.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0);

            const updates = {
                youtube_title: title,
                youtube_description: description,
                youtube_tags: tagsArray,
                // youtube_status: 'ready' // Optional: mark as ready?
            };

            const { data, error: updateError } = await supabase
                .from("video_jobs")
                .update(updates)
                .eq("id", video.id)
                .select()
                .single();

            if (updateError) throw updateError;

            onUpdate(data);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full border border-border shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                    <h3 className="font-bold text-lg">Edit Video Details</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {error && (
                        <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-4">
                        {/* Thumbnail Preview */}
                        <div className="w-32 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={video.thumbnail_url || video.image_url} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-sm text-muted">AI Metadata Generator</h4>
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Generate with AI
                                </button>
                            </div>
                            <p className="text-xs text-muted">
                                Uses your Project Channel Info & Keywords to generate SEO-optimized Title, Description, and Tags.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                placeholder="Video Title..."
                            />
                            <p className="text-xs text-muted text-right mt-1">{title.length}/100</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={6}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                placeholder="Video Description..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                placeholder="lofi, music, relax..."
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Details
                    </button>
                </div>
            </div>
        </div>
    );
}
