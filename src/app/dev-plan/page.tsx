"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Plus, Trash2, Edit2, Check, X, Loader2, GripVertical,
    ChevronDown, ChevronRight, Rocket, Calendar, Flag, AlertCircle, FileText
} from "lucide-react";
import { DevPlanVersion, DevPlanTask, Priority, DevPlanStatus } from "@/lib/types";

const statusColors: Record<DevPlanStatus, string> = {
    planned: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30"
};

const statusLabels: Record<DevPlanStatus, string> = {
    planned: "Planned",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled"
};

const priorityColors: Record<Priority, string> = {
    low: "bg-blue-500/20 text-blue-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    high: "bg-red-500/20 text-red-400"
};

export default function DevPlanPage() {
    const [versions, setVersions] = useState<DevPlanVersion[]>([]);
    const [tasks, setTasks] = useState<Record<string, DevPlanTask[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

    // New version form
    const [showNewVersion, setShowNewVersion] = useState(false);
    const [newVersionName, setNewVersionName] = useState("");
    const [isCreatingVersion, setIsCreatingVersion] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit version
    const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
    const [editVersionName, setEditVersionName] = useState("");

    // New task form
    const [newTaskVersionId, setNewTaskVersionId] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");

    // Edit task
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [editTaskPriority, setEditTaskPriority] = useState<Priority>("medium");

    // Drag state
    const [draggedTask, setDraggedTask] = useState<DevPlanTask | null>(null);
    const [draggedVersion, setDraggedVersion] = useState<DevPlanVersion | null>(null);

    // Expanded task details
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const fetchVersions = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/dev-plan/versions");
            if (res.ok) {
                const data = await res.json();
                setVersions(data);
                // Default view: "Bugs" (1st) closed, 2nd and 3rd expanded
                if (data.length > 0 && expandedVersions.size === 0) {
                    const idsToExpand = new Set<string>();
                    // Expand 2nd and 3rd versions if they exist
                    if (data[1]) idsToExpand.add(data[1].id);
                    if (data[2]) idsToExpand.add(data[2].id);
                    setExpandedVersions(idsToExpand);
                }
            }
        } catch (error) {
            console.error("Error fetching versions:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchTasks = useCallback(async (versionId: string) => {
        try {
            const res = await fetch(`/api/dev-plan/tasks?versionId=${versionId}`);
            if (res.ok) {
                const data = await res.json();
                setTasks((prev) => ({ ...prev, [versionId]: data }));
            }
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    }, []);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    useEffect(() => {
        // Fetch tasks for expanded versions
        expandedVersions.forEach((versionId) => {
            if (!tasks[versionId]) {
                fetchTasks(versionId);
            }
        });
    }, [expandedVersions, fetchTasks, tasks]);

    const toggleVersion = (versionId: string) => {
        const newExpanded = new Set(expandedVersions);
        if (newExpanded.has(versionId)) {
            newExpanded.delete(versionId);
        } else {
            newExpanded.add(versionId);
        }
        setExpandedVersions(newExpanded);
    };

    // Version CRUD
    const handleCreateVersion = async () => {
        if (!newVersionName.trim()) return;

        setIsCreatingVersion(true);
        setError(null);
        try {
            const res = await fetch("/api/dev-plan/versions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newVersionName.trim() })
            });

            if (res.ok) {
                const newVersion = await res.json();
                setVersions([...versions, newVersion]);
                setNewVersionName("");
                setShowNewVersion(false);
                setExpandedVersions(new Set([...expandedVersions, newVersion.id]));
            } else {
                const errData = await res.json();
                setError(errData.error || "Failed to create version");
            }
        } catch (error) {
            console.error("Error creating version:", error);
            setError("Network error - please try again");
        } finally {
            setIsCreatingVersion(false);
        }
    };

    const handleUpdateVersion = async (id: string, updates: Partial<DevPlanVersion>) => {
        try {
            const res = await fetch("/api/dev-plan/versions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...updates })
            });

            if (res.ok) {
                const updated = await res.json();
                setVersions(versions.map((v) => (v.id === id ? { ...v, ...updated } : v)));
            }
        } catch (error) {
            console.error("Error updating version:", error);
        }
        setEditingVersionId(null);
    };

    const handleDeleteVersion = async (id: string) => {
        if (!confirm("Delete this version and all its tasks?")) return;

        try {
            const res = await fetch(`/api/dev-plan/versions?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                setVersions(versions.filter((v) => v.id !== id));
                const newTasks = { ...tasks };
                delete newTasks[id];
                setTasks(newTasks);
            }
        } catch (error) {
            console.error("Error deleting version:", error);
        }
    };

    // Task CRUD
    const handleCreateTask = async (versionId: string) => {
        if (!newTaskTitle.trim()) return;

        try {
            const res = await fetch("/api/dev-plan/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    version_id: versionId,
                    title: newTaskTitle.trim(),
                    priority: newTaskPriority
                })
            });

            if (res.ok) {
                const newTask = await res.json();
                setTasks((prev) => ({
                    ...prev,
                    [versionId]: [...(prev[versionId] || []), newTask]
                }));
                // Update version counts
                setVersions(versions.map((v) =>
                    v.id === versionId
                        ? { ...v, tasks_count: (v.tasks_count || 0) + 1 }
                        : v
                ));
                setNewTaskTitle("");
                setNewTaskPriority("medium");
                setNewTaskVersionId(null);
            }
        } catch (error) {
            console.error("Error creating task:", error);
        }
    };

    const handleUpdateTask = async (taskId: string, versionId: string, updates: Partial<DevPlanTask>) => {
        try {
            const res = await fetch("/api/dev-plan/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: taskId, ...updates })
            });

            if (res.ok) {
                const updated = await res.json();
                setTasks((prev) => ({
                    ...prev,
                    [versionId]: (prev[versionId] || []).map((t) =>
                        t.id === taskId ? { ...t, ...updated } : t
                    )
                }));

                // Update completed count if completion status changed
                if ("completed" in updates) {
                    setVersions(versions.map((v) =>
                        v.id === versionId
                            ? {
                                ...v,
                                completed_count: updates.completed
                                    ? (v.completed_count || 0) + 1
                                    : Math.max(0, (v.completed_count || 0) - 1)
                            }
                            : v
                    ));
                }
            }
        } catch (error) {
            console.error("Error updating task:", error);
        }
        setEditingTaskId(null);
    };

    const handleDeleteTask = async (taskId: string, versionId: string) => {
        try {
            const taskToDelete = (tasks[versionId] || []).find((t) => t.id === taskId);
            const res = await fetch(`/api/dev-plan/tasks?id=${taskId}`, { method: "DELETE" });

            if (res.ok) {
                setTasks((prev) => ({
                    ...prev,
                    [versionId]: (prev[versionId] || []).filter((t) => t.id !== taskId)
                }));
                setVersions(versions.map((v) =>
                    v.id === versionId
                        ? {
                            ...v,
                            tasks_count: Math.max(0, (v.tasks_count || 0) - 1),
                            completed_count: taskToDelete?.completed
                                ? Math.max(0, (v.completed_count || 0) - 1)
                                : v.completed_count
                        }
                        : v
                ));
            }
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    };

    // Drag handlers for tasks
    const handleTaskDragStart = (e: React.DragEvent, task: DevPlanTask) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleTaskDrop = async (e: React.DragEvent, targetTask: DevPlanTask, targetVersionId: string) => {
        e.preventDefault();
        if (!draggedTask || draggedTask.id === targetTask.id) {
            setDraggedTask(null);
            return;
        }

        const sourceVersionId = draggedTask.version_id;
        const sourceTasks = tasks[sourceVersionId] || [];
        const targetTasks = tasks[targetVersionId] || [];

        // Moving within same version
        if (sourceVersionId === targetVersionId) {
            const oldIndex = sourceTasks.findIndex((t) => t.id === draggedTask.id);
            const newIndex = sourceTasks.findIndex((t) => t.id === targetTask.id);

            const reordered = [...sourceTasks];
            const [removed] = reordered.splice(oldIndex, 1);
            reordered.splice(newIndex, 0, removed);

            const updates = reordered.map((task, index) => ({
                id: task.id,
                order_index: index
            }));

            setTasks((prev) => ({ ...prev, [sourceVersionId]: reordered }));

            await fetch("/api/dev-plan/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reorder: true, items: updates })
            });
        } else {
            // Moving to different version
            const newSourceTasks = sourceTasks.filter((t) => t.id !== draggedTask.id);
            const targetIndex = targetTasks.findIndex((t) => t.id === targetTask.id);
            const newTargetTasks = [...targetTasks];
            newTargetTasks.splice(targetIndex, 0, { ...draggedTask, version_id: targetVersionId });

            setTasks((prev) => ({
                ...prev,
                [sourceVersionId]: newSourceTasks,
                [targetVersionId]: newTargetTasks
            }));

            // Update counts
            setVersions(versions.map((v) => {
                if (v.id === sourceVersionId) {
                    return {
                        ...v,
                        tasks_count: Math.max(0, (v.tasks_count || 0) - 1),
                        completed_count: draggedTask.completed ? Math.max(0, (v.completed_count || 0) - 1) : v.completed_count
                    };
                }
                if (v.id === targetVersionId) {
                    return {
                        ...v,
                        tasks_count: (v.tasks_count || 0) + 1,
                        completed_count: draggedTask.completed ? (v.completed_count || 0) + 1 : v.completed_count
                    };
                }
                return v;
            }));

            // Update task's version in backend
            await fetch("/api/dev-plan/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: draggedTask.id, version_id: targetVersionId })
            });
        }

        setDraggedTask(null);
    };

    // Version drag handlers
    const handleVersionDragStart = (e: React.DragEvent, version: DevPlanVersion) => {
        setDraggedVersion(version);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleVersionDrop = async (e: React.DragEvent, targetVersion: DevPlanVersion) => {
        e.preventDefault();
        if (!draggedVersion || draggedVersion.id === targetVersion.id) {
            setDraggedVersion(null);
            return;
        }

        const oldIndex = versions.findIndex((v) => v.id === draggedVersion.id);
        const newIndex = versions.findIndex((v) => v.id === targetVersion.id);

        const reordered = [...versions];
        const [removed] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, removed);

        const updates = reordered.map((version, index) => ({
            id: version.id,
            order_index: index
        }));

        setVersions(reordered);

        await fetch("/api/dev-plan/versions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reorder: true, items: updates })
        });

        setDraggedVersion(null);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
                        <Rocket className="w-8 h-8" />
                        Dev Plan
                    </h1>
                    <p className="text-muted mt-1">Global development roadmap with versions and tasks</p>
                </div>
                <button
                    onClick={() => setShowNewVersion(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg font-medium
                        hover:bg-primary-hover transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Add Version
                </button>
            </div>

            {/* New Version Form */}
            {showNewVersion && (
                <div className="mb-6 p-4 bg-card border border-border rounded-xl animate-in fade-in">
                    <h3 className="font-medium mb-3">New Version</h3>
                    {error && (
                        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newVersionName}
                            onChange={(e) => setNewVersionName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreateVersion()}
                            placeholder="e.g., v1.0, Sprint 3..."
                            className="flex-1 bg-background border border-border rounded-lg px-4 py-2
                                focus:ring-2 focus:ring-primary/50 focus:outline-none"
                            autoFocus
                        />
                        <button
                            onClick={handleCreateVersion}
                            disabled={!newVersionName.trim() || isCreatingVersion}
                            className="px-4 py-2 bg-primary text-black rounded-lg font-medium
                                hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isCreatingVersion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Create
                        </button>
                        <button
                            onClick={() => { setShowNewVersion(false); setError(null); }}
                            className="px-4 py-2 border border-border rounded-lg hover:bg-card transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Versions List */}
            {versions.length === 0 ? (
                <div className="text-center py-16 text-muted">
                    <Rocket className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No versions yet</p>
                    <p className="text-sm mt-1">Create your first version to start planning</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {versions.map((version) => {
                        const isExpanded = expandedVersions.has(version.id);
                        const versionTasks = tasks[version.id] || [];
                        const progress = (version.tasks_count || 0) > 0
                            ? ((version.completed_count || 0) / (version.tasks_count || 1)) * 100
                            : 0;

                        return (
                            <div
                                key={version.id}
                                draggable
                                onDragStart={(e) => handleVersionDragStart(e, version)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleVersionDrop(e, version)}
                                className={`bg-card border border-border rounded-xl overflow-hidden transition-all
                                    ${draggedVersion?.id === version.id ? "opacity-50" : ""}`}
                            >
                                {/* Version Header */}
                                <div
                                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-card-hover transition-colors"
                                    onClick={() => toggleVersion(version.id)}
                                >
                                    <GripVertical className="w-4 h-4 text-muted cursor-grab" />
                                    {isExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-muted" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-muted" />
                                    )}

                                    {editingVersionId === version.id ? (
                                        <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editVersionName}
                                                onChange={(e) => setEditVersionName(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleUpdateVersion(version.id, { name: editVersionName })}
                                                className="flex-1 bg-background border border-primary rounded px-2 py-1"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleUpdateVersion(version.id, { name: editVersionName })}
                                                className="p-1 bg-primary text-black rounded"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditingVersionId(null)}
                                                className="p-1 hover:bg-card rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="flex-1 font-semibold text-lg">{version.name}</span>
                                            <span className="text-sm text-muted">
                                                {version.completed_count || 0}/{version.tasks_count || 0} tasks
                                            </span>
                                        </>
                                    )}

                                    {/* Progress bar */}
                                    <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${progress === 100 ? "bg-green-500" : "bg-primary"}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>

                                    {/* Status */}
                                    <select
                                        value={version.status}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            handleUpdateVersion(version.id, { status: e.target.value as DevPlanStatus });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[version.status]} bg-transparent`}
                                    >
                                        {Object.entries(statusLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => {
                                                setEditingVersionId(version.id);
                                                setEditVersionName(version.name);
                                            }}
                                            className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVersion(version.id)}
                                            className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tasks */}
                                {isExpanded && (
                                    <div className="border-t border-border p-4 space-y-2 bg-background/50">
                                        {versionTasks.length === 0 ? (
                                            <p className="text-sm text-muted text-center py-4">No tasks yet</p>
                                        ) : (
                                            versionTasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    draggable
                                                    onDragStart={(e) => handleTaskDragStart(e, task)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => handleTaskDrop(e, task, version.id)}
                                                    className={`flex flex-col gap-1 rounded-lg border border-border group bg-card
                                                        ${draggedTask?.id === task.id ? "opacity-50" : ""}`}
                                                >
                                                    <div className="flex items-center gap-3 p-3">
                                                        <GripVertical className="w-4 h-4 text-muted cursor-grab" />

                                                        {/* Checkbox */}
                                                        <button
                                                            onClick={() => handleUpdateTask(task.id, version.id, { completed: !task.completed })}
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center
                                                            ${task.completed ? "bg-primary border-primary" : "border-border hover:border-primary/50"}`}
                                                        >
                                                            {task.completed && <Check className="w-3 h-3 text-black" />}
                                                        </button>

                                                        {editingTaskId === task.id ? (
                                                            <>
                                                                <input
                                                                    type="text"
                                                                    value={editTaskTitle}
                                                                    onChange={(e) => setEditTaskTitle(e.target.value)}
                                                                    onKeyDown={(e) => e.key === "Enter" && handleUpdateTask(task.id, version.id, { title: editTaskTitle, priority: editTaskPriority })}
                                                                    className="flex-1 bg-background border border-primary rounded px-2 py-1"
                                                                    autoFocus
                                                                />
                                                                <select
                                                                    value={editTaskPriority}
                                                                    onChange={(e) => setEditTaskPriority(e.target.value as Priority)}
                                                                    className="bg-background border border-border rounded px-2 py-1 text-xs"
                                                                >
                                                                    <option value="low">Low</option>
                                                                    <option value="medium">Medium</option>
                                                                    <option value="high">High</option>
                                                                </select>
                                                                <button
                                                                    onClick={() => handleUpdateTask(task.id, version.id, { title: editTaskTitle, priority: editTaskPriority })}
                                                                    className="p-1 bg-primary text-black rounded"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingTaskId(null)}
                                                                    className="p-1 hover:bg-card rounded"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className={`flex-1 ${task.completed ? "line-through text-muted" : ""}`}>
                                                                    {task.title}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[task.priority]}`}>
                                                                    {task.priority}
                                                                </span>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingTaskId(task.id);
                                                                        setEditTaskTitle(task.title);
                                                                        setEditTaskPriority(task.priority);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 text-muted hover:text-primary"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTask(task.id, version.id)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-500"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                                                    className={`p-1 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors
                                                                    ${expandedTaskId === task.id ? "text-primary bg-primary/10" : ""}
                                                                    ${task.description ? "text-primary/70" : ""}`}
                                                                >
                                                                    {task.description ? <FileText className="w-4 h-4" /> : <ChevronDown className={`w-4 h-4 transition-transform ${expandedTaskId === task.id ? "rotate-180" : ""}`} />}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Task Details (Description) */}
                                                    {expandedTaskId === task.id && (
                                                        <div className="ml-11 mr-2 mb-2 p-3 bg-background/50 border border-border rounded-lg animate-in slide-in-from-top-2">
                                                            <textarea
                                                                placeholder="Add details, notes, or acceptance criteria..."
                                                                className="w-full bg-transparent border-none text-sm text-muted-foreground focus:text-foreground
                                                                resize-y min-h-[80px] focus:outline-none placeholder:text-muted/50"
                                                                defaultValue={task.description || ""}
                                                                onBlur={(e) => {
                                                                    const newDesc = e.target.value.trim();
                                                                    if (newDesc !== (task.description || "")) {
                                                                        handleUpdateTask(task.id, version.id, { description: newDesc });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}

                                        {/* Add Task Form */}
                                        {newTaskVersionId === version.id ? (
                                            <div className="flex gap-2 pt-2">
                                                <input
                                                    type="text"
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleCreateTask(version.id)}
                                                    placeholder="Task title..."
                                                    className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm"
                                                    autoFocus
                                                />
                                                <select
                                                    value={newTaskPriority}
                                                    onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                                                    className="bg-card border border-border rounded-lg px-2 py-2 text-sm"
                                                >
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                </select>
                                                <button
                                                    onClick={() => handleCreateTask(version.id)}
                                                    disabled={!newTaskTitle.trim()}
                                                    className="px-3 py-2 bg-primary text-black rounded-lg disabled:opacity-50"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setNewTaskVersionId(null)}
                                                    className="px-3 py-2 border border-border rounded-lg hover:bg-card"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setNewTaskVersionId(version.id)}
                                                className="w-full py-2 border border-dashed border-border rounded-lg text-muted
                                                    hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Task
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
