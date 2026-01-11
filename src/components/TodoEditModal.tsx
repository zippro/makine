"use client";

import { useState, useEffect } from "react";
import { X, Save, Trash2, Loader2, Calendar, Flag } from "lucide-react";
import { TodoItem, Priority } from "@/lib/types";

interface TodoEditModalProps {
    item: TodoItem | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: Partial<TodoItem>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
    { value: "low", label: "Low", color: "bg-blue-500" },
    { value: "medium", label: "Medium", color: "bg-yellow-500" },
    { value: "high", label: "High", color: "bg-red-500" }
];

export default function TodoEditModal({
    item,
    isOpen,
    onClose,
    onSave,
    onDelete
}: TodoEditModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<Priority>("medium");
    const [dueDate, setDueDate] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (item) {
            setTitle(item.title);
            setDescription(item.description || "");
            setPriority(item.priority);
            setDueDate(item.due_date || "");
        }
    }, [item]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            return () => document.removeEventListener("keydown", handleEscape);
        }
    }, [isOpen, onClose]);

    const handleSave = async () => {
        if (!item || !title.trim()) return;

        setIsSaving(true);
        await onSave(item.id, {
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            due_date: dueDate || undefined
        });
        setIsSaving(false);
        onClose();
    };

    const handleDelete = async () => {
        if (!item) return;
        if (!confirm("Delete this task? This cannot be undone.")) return;

        setIsDeleting(true);
        await onDelete(item.id);
        setIsDeleting(false);
        onClose();
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold">Edit Task</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-card-hover transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title..."
                            className="w-full bg-background border border-border rounded-lg px-4 py-3
                                focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none
                                text-lg font-medium"
                            autoFocus
                        />
                    </div>

                    {/* Description - Rich textarea */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add notes, details, or instructions..."
                            rows={4}
                            className="w-full bg-background border border-border rounded-lg px-4 py-3
                                focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none
                                resize-none"
                        />
                    </div>

                    {/* Priority & Due Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Priority */}
                        <div>
                            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                <Flag className="w-4 h-4" />
                                Priority
                            </label>
                            <div className="flex gap-2">
                                {priorityOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setPriority(opt.value)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                                            ${priority === opt.value
                                                ? `${opt.color} text-white`
                                                : "bg-background border border-border hover:border-primary/30"
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Due Date */}
                        <div>
                            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-4 py-2.5
                                    focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Task Info */}
                    <div className="text-xs text-muted pt-2 border-t border-border">
                        <span>Created: {new Date(item.created_at).toLocaleString()}</span>
                        {item.updated_at !== item.created_at && (
                            <span className="ml-4">Updated: {new Date(item.updated_at).toLocaleString()}</span>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-border bg-background/50 rounded-b-2xl">
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-500
                            hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >
                        {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        Delete
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-border hover:bg-card transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!title.trim() || isSaving}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-black font-medium
                                hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
