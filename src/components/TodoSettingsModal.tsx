"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, GripVertical, Loader2, Settings, Edit2, Check, ListPlus } from "lucide-react";
import { DefaultTask, Priority } from "@/lib/types";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface TodoSettingsModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
}

const priorityColors: Record<Priority, string> = {
    low: "bg-blue-500/20 text-blue-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    high: "bg-red-500/20 text-red-400"
};

export default function TodoSettingsModal({
    projectId,
    isOpen,
    onClose
}: TodoSettingsModalProps) {
    const [defaultTasks, setDefaultTasks] = useState<DefaultTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editPriority, setEditPriority] = useState<Priority>("medium");

    // Sync confirmation state
    const [showSyncConfirm, setShowSyncConfirm] = useState(false);
    const [pendingTask, setPendingTask] = useState<DefaultTask | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [existingListsCount, setExistingListsCount] = useState(0);

    useEscapeKey(() => isOpen && onClose());

    useEffect(() => {
        if (isOpen && projectId) {
            fetchDefaultTasks();
            fetchListsCount();
        }
    }, [isOpen, projectId]);

    const fetchDefaultTasks = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/todos/defaults?projectId=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setDefaultTasks(data);
            }
        } catch (error) {
            console.error("Error fetching default tasks:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchListsCount = async () => {
        try {
            const res = await fetch(`/api/todos?projectId=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setExistingListsCount(data.length);
            }
        } catch (error) {
            console.error("Error fetching lists count:", error);
        }
    };

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;

        setIsSaving(true);
        try {
            const res = await fetch("/api/todos/defaults", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: projectId,
                    title: newTaskTitle.trim(),
                    priority: newTaskPriority
                })
            });

            if (res.ok) {
                const newTask = await res.json();
                setDefaultTasks([...defaultTasks, newTask]);
                setNewTaskTitle("");
                setNewTaskPriority("medium");

                // If there are existing lists, ask if user wants to sync
                if (existingListsCount > 0) {
                    setPendingTask(newTask);
                    setShowSyncConfirm(true);
                }
            }
        } catch (error) {
            console.error("Error adding default task:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSyncToExisting = async () => {
        if (!pendingTask) return;

        setIsSyncing(true);
        try {
            // Call API to add this task to all existing lists
            const res = await fetch("/api/todos/defaults/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: projectId,
                    task: {
                        title: pendingTask.title,
                        description: pendingTask.description,
                        priority: pendingTask.priority
                    }
                })
            });

            if (res.ok) {
                const result = await res.json();
                console.log(`Synced to ${result.syncedCount} lists`);
            }
        } catch (error) {
            console.error("Error syncing task:", error);
        } finally {
            setIsSyncing(false);
            setShowSyncConfirm(false);
            setPendingTask(null);
        }
    };

    const handleUpdateTask = async (id: string) => {
        if (!editTitle.trim()) return;

        try {
            const res = await fetch("/api/todos/defaults", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    title: editTitle.trim(),
                    priority: editPriority
                })
            });

            if (res.ok) {
                const updated = await res.json();
                setDefaultTasks(defaultTasks.map((t) => (t.id === id ? updated : t)));
            }
        } catch (error) {
            console.error("Error updating default task:", error);
        }
        setEditingId(null);
    };

    const handleDeleteTask = async (id: string) => {
        try {
            const res = await fetch(`/api/todos/defaults?id=${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                setDefaultTasks(defaultTasks.filter((t) => t.id !== id));
            }
        } catch (error) {
            console.error("Error deleting default task:", error);
        }
    };

    const startEdit = (task: DefaultTask) => {
        setEditingId(task.id);
        setEditTitle(task.title);
        setEditPriority(task.priority);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddTask();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Settings className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">Default Tasks</h2>
                            <p className="text-sm text-muted">
                                These tasks are auto-added to new todo lists
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-card-hover transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[50vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Add New Task */}
                            <div className="mb-6 p-4 bg-background rounded-xl border border-border">
                                <h3 className="text-sm font-medium mb-3">Add Default Task</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Task title..."
                                        className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm
                                            focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                    />
                                    <select
                                        value={newTaskPriority}
                                        onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                                        className="bg-card border border-border rounded-lg px-3 py-2 text-sm
                                            focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                    <button
                                        onClick={handleAddTask}
                                        disabled={!newTaskTitle.trim() || isSaving}
                                        className="px-4 py-2 bg-primary text-black rounded-lg font-medium
                                            hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed
                                            transition-all flex items-center gap-2"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Plus className="w-4 h-4" />
                                        )}
                                        Add
                                    </button>
                                </div>
                                {existingListsCount > 0 && (
                                    <p className="text-xs text-muted mt-2">
                                        You have {existingListsCount} existing list(s). New tasks can be synced to them.
                                    </p>
                                )}
                            </div>

                            {/* Task List */}
                            {defaultTasks.length === 0 ? (
                                <div className="text-center py-8 text-muted">
                                    <p>No default tasks configured</p>
                                    <p className="text-sm mt-1">Add tasks above to auto-populate new lists</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {defaultTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border group"
                                        >
                                            <GripVertical className="w-4 h-4 text-muted cursor-grab" />

                                            {editingId === task.id ? (
                                                // Edit mode
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && handleUpdateTask(task.id)}
                                                        className="flex-1 bg-card border border-primary rounded px-2 py-1 text-sm focus:outline-none"
                                                        autoFocus
                                                    />
                                                    <select
                                                        value={editPriority}
                                                        onChange={(e) => setEditPriority(e.target.value as Priority)}
                                                        className="bg-card border border-border rounded px-2 py-1 text-xs"
                                                    >
                                                        <option value="low">Low</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="high">High</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleUpdateTask(task.id)}
                                                        className="p-1.5 rounded bg-primary text-black hover:bg-primary-hover"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-1.5 rounded hover:bg-card text-muted"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                // View mode
                                                <>
                                                    <span className="flex-1 truncate">{task.title}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[task.priority]}`}>
                                                        {task.priority}
                                                    </span>
                                                    <button
                                                        onClick={() => startEdit(task)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary transition-all"
                                                        title="Edit task"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTask(task.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-500 transition-all"
                                                        title="Delete task"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-background/50">
                    <p className="text-xs text-muted text-center">
                        Default tasks will be added to every new todo list created in this project
                    </p>
                </div>
            </div>

            {/* Sync Confirmation Modal */}
            {showSyncConfirm && pendingTask && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowSyncConfirm(false)} />
                    <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <ListPlus className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold">Add to Existing Lists?</h3>
                        </div>
                        <p className="text-sm text-muted mb-4">
                            You added <strong>&quot;{pendingTask.title}&quot;</strong> as a default task.
                            Would you like to add it to your <strong>{existingListsCount} existing todo list(s)</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowSyncConfirm(false);
                                    setPendingTask(null);
                                }}
                                className="flex-1 py-2 border border-border rounded-lg hover:bg-card transition-all"
                            >
                                No, Skip
                            </button>
                            <button
                                onClick={handleSyncToExisting}
                                disabled={isSyncing}
                                className="flex-1 py-2 bg-primary text-black rounded-lg font-medium
                                    hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {isSyncing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ListPlus className="w-4 h-4" />
                                )}
                                Yes, Add to All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
