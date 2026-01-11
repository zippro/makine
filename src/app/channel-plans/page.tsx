"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Plus, Trash2, Edit2, Check, X, Loader2, GripVertical,
    ChevronDown, ChevronRight, Rocket, Calendar, AlertCircle, FileText
} from "lucide-react";
import { ChannelPlanContainer, ChannelPlanItem, Priority, DevPlanStatus } from "@/lib/types";

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

export default function ChannelPlansPage() {
    const [containers, setContainers] = useState<ChannelPlanContainer[]>([]);
    const [items, setItems] = useState<Record<string, ChannelPlanItem[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set());

    // New container form
    const [showNewContainer, setShowNewContainer] = useState(false);
    const [newContainerName, setNewContainerName] = useState("");
    const [isCreatingContainer, setIsCreatingContainer] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit container
    const [editingContainerId, setEditingContainerId] = useState<string | null>(null);
    const [editContainerName, setEditContainerName] = useState("");

    // New item form
    const [newItemContainerId, setNewItemContainerId] = useState<string | null>(null);
    const [newItemTitle, setNewItemTitle] = useState("");
    const [newItemPriority, setNewItemPriority] = useState<Priority>("medium");

    // Edit item
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editItemTitle, setEditItemTitle] = useState("");
    const [editItemPriority, setEditItemPriority] = useState<Priority>("medium");

    // Drag state
    const [draggedItem, setDraggedItem] = useState<ChannelPlanItem | null>(null);
    const [draggedContainer, setDraggedContainer] = useState<ChannelPlanContainer | null>(null);

    // Expanded item details
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

    const sortContainers = useCallback((list: ChannelPlanContainer[]) => {
        return [...list].sort((a, b) => {
            // Check if fully complete (has items and all are done)
            const aComplete = (a.items_count || 0) > 0 && a.completed_count === a.items_count;
            const bComplete = (b.items_count || 0) > 0 && b.completed_count === b.items_count;

            if (aComplete && !bComplete) return 1; // a goes to bottom
            if (!aComplete && bComplete) return -1; // b goes to bottom

            // Otherwise sort by order_index
            return (a.order_index || 0) - (b.order_index || 0);
        });
    }, []);

    const fetchContainers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/channel-plan/containers");
            if (res.ok) {
                const data = await res.json();
                setContainers(sortContainers(data));
                // Expand first container by default
                if (data.length > 0 && expandedContainers.size === 0) {
                    setExpandedContainers(new Set([data[0].id]));
                }
            }
        } catch (error) {
            console.error("Error fetching containers:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchItems = useCallback(async (containerId: string) => {
        try {
            const res = await fetch(`/api/channel-plan/items?containerId=${containerId}`);
            if (res.ok) {
                const data = await res.json();
                setItems((prev) => ({ ...prev, [containerId]: data }));
            }
        } catch (error) {
            console.error("Error fetching items:", error);
        }
    }, []);

    useEffect(() => {
        fetchContainers();
    }, [fetchContainers]);

    useEffect(() => {
        // Fetch items for expanded containers
        expandedContainers.forEach((containerId) => {
            if (!items[containerId]) {
                fetchItems(containerId);
            }
        });
    }, [expandedContainers, fetchItems, items]);

    const toggleContainer = (containerId: string) => {
        const newExpanded = new Set(expandedContainers);
        if (newExpanded.has(containerId)) {
            newExpanded.delete(containerId);
        } else {
            newExpanded.add(containerId);
        }
        setExpandedContainers(newExpanded);
    };

    // Container CRUD
    const handleCreateContainer = async () => {
        if (!newContainerName.trim()) return;

        setIsCreatingContainer(true);
        setError(null);
        try {
            const res = await fetch("/api/channel-plan/containers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newContainerName.trim() })
            });

            if (res.ok) {
                const newContainer = await res.json();
                setContainers([...containers, newContainer]);
                setNewContainerName("");
                setShowNewContainer(false);
                setExpandedContainers(new Set([...expandedContainers, newContainer.id]));
            } else {
                const errData = await res.json();
                setError(errData.error || "Failed to create period");
            }
        } catch (error) {
            console.error("Error creating period:", error);
            setError("Network error - please try again");
        } finally {
            setIsCreatingContainer(false);
        }
    };

    const handleUpdateContainer = async (id: string, updates: Partial<ChannelPlanContainer>) => {
        try {
            const res = await fetch("/api/channel-plan/containers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...updates })
            });

            if (res.ok) {
                const updated = await res.json();
                setContainers(containers.map((c) => (c.id === id ? { ...c, ...updated } : c)));
            }
        } catch (error) {
            console.error("Error updating period:", error);
        }
        setEditingContainerId(null);
    };

    const handleDeleteContainer = async (id: string) => {
        if (!confirm("Delete this period and all its items?")) return;

        try {
            const res = await fetch(`/api/channel-plan/containers?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                setContainers(containers.filter((c) => c.id !== id));
                const newItems = { ...items };
                delete newItems[id];
                setItems(newItems);
            }
        } catch (error) {
            console.error("Error deleting period:", error);
        }
    };

    // Item CRUD
    const handleCreateItem = async (containerId: string) => {
        if (!newItemTitle.trim()) return;

        try {
            const res = await fetch("/api/channel-plan/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    container_id: containerId,
                    title: newItemTitle.trim(),
                    priority: newItemPriority
                })
            });

            if (res.ok) {
                const newItem = await res.json();
                setItems((prev) => ({
                    ...prev,
                    [containerId]: [...(prev[containerId] || []), newItem]
                }));
                // Update container counts
                setContainers(prev => sortContainers(prev.map((c) =>
                    c.id === containerId
                        ? { ...c, items_count: (c.items_count || 0) + 1 }
                        : c
                )));
                setNewItemTitle("");
                setNewItemPriority("medium");
                setNewItemContainerId(null);
            }
        } catch (error) {
            console.error("Error creating item:", error);
        }
    };

    const handleUpdateItem = async (itemId: string, containerId: string, updates: Partial<ChannelPlanItem>) => {
        try {
            const res = await fetch("/api/channel-plan/items", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: itemId, ...updates })
            });

            if (res.ok) {
                const updated = await res.json();
                setItems((prev) => ({
                    ...prev,
                    [containerId]: (prev[containerId] || []).map((t) =>
                        t.id === itemId ? { ...t, ...updated } : t
                    )
                }));

                // Update completed count if completion status changed
                if ("completed" in updates) {
                    setContainers(prev => sortContainers(prev.map((c) =>
                        c.id === containerId
                            ? {
                                ...c,
                                completed_count: updates.completed
                                    ? (c.completed_count || 0) + 1
                                    : Math.max(0, (c.completed_count || 0) - 1)
                            }
                            : c
                    )));
                }
            }
        } catch (error) {
            console.error("Error updating item:", error);
        }
        setEditingItemId(null);
    };

    const handleDeleteItem = async (itemId: string, containerId: string) => {
        try {
            const itemToDelete = (items[containerId] || []).find((t) => t.id === itemId);
            const res = await fetch(`/api/channel-plan/items?id=${itemId}`, { method: "DELETE" });

            if (res.ok) {
                setItems((prev) => ({
                    ...prev,
                    [containerId]: (prev[containerId] || []).filter((t) => t.id !== itemId)
                }));
                setContainers(prev => sortContainers(prev.map((c) =>
                    c.id === containerId
                        ? {
                            ...c,
                            items_count: Math.max(0, (c.items_count || 0) - 1),
                            completed_count: itemToDelete?.completed
                                ? Math.max(0, (c.completed_count || 0) - 1)
                                : c.completed_count
                        }
                        : c
                )));
            }
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };

    // Drag handlers for items
    const handleItemDragStart = (e: React.DragEvent, item: ChannelPlanItem) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleItemDrop = async (e: React.DragEvent, targetItem: ChannelPlanItem, targetContainerId: string) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.id === targetItem.id) {
            setDraggedItem(null);
            return;
        }

        const sourceContainerId = draggedItem.container_id;
        const sourceItems = items[sourceContainerId] || [];
        const targetItems = items[targetContainerId] || [];

        // Moving within same container
        if (sourceContainerId === targetContainerId) {
            const oldIndex = sourceItems.findIndex((t) => t.id === draggedItem.id);
            const newIndex = sourceItems.findIndex((t) => t.id === targetItem.id);

            const reordered = [...sourceItems];
            const [removed] = reordered.splice(oldIndex, 1);
            reordered.splice(newIndex, 0, removed);

            const updates = reordered.map((item, index) => ({
                id: item.id,
                order_index: index
            }));

            setItems((prev) => ({ ...prev, [sourceContainerId]: reordered }));

            await fetch("/api/channel-plan/items", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reorder: true, items: updates })
            });
        } else {
            // Moving to different container
            const newSourceItems = sourceItems.filter((t) => t.id !== draggedItem.id);
            const targetIndex = targetItems.findIndex((t) => t.id === targetItem.id);
            const newTargetItems = [...targetItems];
            newTargetItems.splice(targetIndex, 0, { ...draggedItem, container_id: targetContainerId });

            setItems((prev) => ({
                ...prev,
                [sourceContainerId]: newSourceItems,
                [targetContainerId]: newTargetItems
            }));

            // Update counts
            setContainers(prev => sortContainers(prev.map((c) => {
                if (c.id === sourceContainerId) {
                    return {
                        ...c,
                        items_count: Math.max(0, (c.items_count || 0) - 1),
                        completed_count: draggedItem.completed ? Math.max(0, (c.completed_count || 0) - 1) : c.completed_count
                    };
                }
                if (c.id === targetContainerId) {
                    return {
                        ...c,
                        items_count: (c.items_count || 0) + 1,
                        completed_count: draggedItem.completed ? (c.completed_count || 0) + 1 : c.completed_count
                    };
                }
                return c;
            })));

            // Update item's container in backend
            await fetch("/api/channel-plan/items", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: draggedItem.id, container_id: targetContainerId })
            });
        }

        setDraggedItem(null);
    };

    // Container drag handlers
    const handleContainerDragStart = (e: React.DragEvent, container: ChannelPlanContainer) => {
        setDraggedContainer(container);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleContainerDrop = async (e: React.DragEvent, targetContainer: ChannelPlanContainer) => {
        e.preventDefault();
        if (!draggedContainer || draggedContainer.id === targetContainer.id) {
            setDraggedContainer(null);
            return;
        }

        const oldIndex = containers.findIndex((c) => c.id === draggedContainer.id);
        const newIndex = containers.findIndex((c) => c.id === targetContainer.id);

        const reordered = [...containers];
        const [removed] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, removed);

        const updates = reordered.map((container, index) => ({
            id: container.id,
            order_index: index
        }));

        setContainers(reordered);

        await fetch("/api/channel-plan/containers", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reorder: true, items: updates })
        });

        setDraggedContainer(null);
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
                        <Calendar className="w-8 h-8" />
                        Channel Plans
                    </h1>
                    <p className="text-muted mt-1">Long-term content planning (Months & Weeks)</p>
                </div>
                <button
                    onClick={() => setShowNewContainer(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg font-medium
                        hover:bg-primary-hover transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Add Period
                </button>
            </div>

            {/* New Container Form */}
            {showNewContainer && (
                <div className="mb-6 p-4 bg-card border border-border rounded-xl animate-in fade-in">
                    <h3 className="font-medium mb-3">New Period</h3>
                    {error && (
                        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newContainerName}
                            onChange={(e) => setNewContainerName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreateContainer()}
                            placeholder="e.g., January 2026, Week 1..."
                            className="flex-1 bg-background border border-border rounded-lg px-4 py-2
                                focus:ring-2 focus:ring-primary/50 focus:outline-none"
                            autoFocus
                        />
                        <button
                            onClick={handleCreateContainer}
                            disabled={!newContainerName.trim() || isCreatingContainer}
                            className="px-4 py-2 bg-primary text-black rounded-lg font-medium
                                hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isCreatingContainer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Create
                        </button>
                        <button
                            onClick={() => { setShowNewContainer(false); setError(null); }}
                            className="px-4 py-2 border border-border rounded-lg hover:bg-card transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Containers List */}
            {containers.length === 0 ? (
                <div className="text-center py-16 text-muted">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No plans yet</p>
                    <p className="text-sm mt-1">Create your first period to start planning content</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {containers.map((container) => {
                        const isExpanded = expandedContainers.has(container.id);
                        const containerItems = items[container.id] || [];
                        const progress = (container.items_count || 0) > 0
                            ? ((container.completed_count || 0) / (container.items_count || 1)) * 100
                            : 0;

                        return (
                            <div
                                key={container.id}
                                draggable
                                onDragStart={(e) => handleContainerDragStart(e, container)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleContainerDrop(e, container)}
                                className={`bg-card border border-border rounded-xl overflow-hidden transition-all
                                    ${draggedContainer?.id === container.id ? "opacity-50" : ""}`}
                            >
                                {/* Container Header */}
                                <div
                                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-card-hover transition-colors"
                                    onClick={() => toggleContainer(container.id)}
                                >
                                    <GripVertical className="w-4 h-4 text-muted cursor-grab" />
                                    {isExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-muted" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-muted" />
                                    )}

                                    {editingContainerId === container.id ? (
                                        <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editContainerName}
                                                onChange={(e) => setEditContainerName(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleUpdateContainer(container.id, { name: editContainerName })}
                                                className="flex-1 bg-background border border-primary rounded px-2 py-1"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleUpdateContainer(container.id, { name: editContainerName })}
                                                className="p-1 bg-primary text-black rounded"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditingContainerId(null)}
                                                className="p-1 hover:bg-card rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="flex-1 font-semibold text-lg">{container.name}</span>
                                            <span className="text-sm text-muted">
                                                {container.completed_count || 0}/{container.items_count || 0} items
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
                                        value={container.status}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            handleUpdateContainer(container.id, { status: e.target.value as DevPlanStatus });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[container.status]} bg-transparent`}
                                    >
                                        {Object.entries(statusLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => {
                                                setEditingContainerId(container.id);
                                                setEditContainerName(container.name);
                                            }}
                                            className="p-1.5 rounded hover:bg-primary/10 text-muted hover:text-primary"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteContainer(container.id)}
                                            className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Items */}
                                {isExpanded && (
                                    <div className="border-t border-border p-4 space-y-2 bg-background/50">
                                        {containerItems.length === 0 ? (
                                            <p className="text-sm text-muted text-center py-4">No content planned yet</p>
                                        ) : (
                                            containerItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    draggable
                                                    onDragStart={(e) => handleItemDragStart(e, item)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => handleItemDrop(e, item, container.id)}
                                                    className={`flex flex-col gap-1 rounded-lg border border-border group bg-card
                                                        ${draggedItem?.id === item.id ? "opacity-50" : ""}`}
                                                >
                                                    <div className="flex items-center gap-3 p-3">
                                                        <GripVertical className="w-4 h-4 text-muted cursor-grab" />

                                                        {/* Checkbox */}
                                                        <button
                                                            onClick={() => handleUpdateItem(item.id, container.id, { completed: !item.completed })}
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center
                                                            ${item.completed ? "bg-primary border-primary" : "border-border hover:border-primary/50"}`}
                                                        >
                                                            {item.completed && <Check className="w-3 h-3 text-black" />}
                                                        </button>

                                                        {editingItemId === item.id ? (
                                                            <>
                                                                <input
                                                                    type="text"
                                                                    value={editItemTitle}
                                                                    onChange={(e) => setEditItemTitle(e.target.value)}
                                                                    onKeyDown={(e) => e.key === "Enter" && handleUpdateItem(item.id, container.id, { title: editItemTitle, priority: editItemPriority })}
                                                                    className="flex-1 bg-background border border-primary rounded px-2 py-1"
                                                                    autoFocus
                                                                />
                                                                <select
                                                                    value={editItemPriority}
                                                                    onChange={(e) => setEditItemPriority(e.target.value as Priority)}
                                                                    className="bg-background border border-border rounded px-2 py-1 text-xs"
                                                                >
                                                                    <option value="low">Low</option>
                                                                    <option value="medium">Medium</option>
                                                                    <option value="high">High</option>
                                                                </select>
                                                                <button
                                                                    onClick={() => handleUpdateItem(item.id, container.id, { title: editItemTitle, priority: editItemPriority })}
                                                                    className="p-1 bg-primary text-black rounded"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingItemId(null)}
                                                                    className="p-1 hover:bg-card rounded"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className={`flex-1 ${item.completed ? "line-through text-muted" : ""}`}>
                                                                    {item.title}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[item.priority]}`}>
                                                                    {item.priority}
                                                                </span>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingItemId(item.id);
                                                                        setEditItemTitle(item.title);
                                                                        setEditItemPriority(item.priority);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 text-muted hover:text-primary"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteItem(item.id, container.id)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-500"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                                                    className={`p-1 rounded hover:bg-primary/10 text-muted hover:text-primary transition-colors
                                                                    ${expandedItemId === item.id ? "text-primary bg-primary/10" : ""}
                                                                    ${item.description ? "text-primary/70" : ""}`}
                                                                >
                                                                    {item.description ? <FileText className="w-4 h-4" /> : <ChevronDown className={`w-4 h-4 transition-transform ${expandedItemId === item.id ? "rotate-180" : ""}`} />}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Item Details (Description) */}
                                                    {expandedItemId === item.id && (
                                                        <div className="ml-11 mr-2 mb-2 p-3 bg-background/50 border border-border rounded-lg animate-in slide-in-from-top-2">
                                                            <textarea
                                                                placeholder="Add content details, timeline notes..."
                                                                className="w-full bg-transparent border-none text-sm text-muted-foreground focus:text-foreground
                                                                resize-y min-h-[80px] focus:outline-none placeholder:text-muted/50"
                                                                defaultValue={item.description || ""}
                                                                onBlur={(e) => {
                                                                    const newDesc = e.target.value.trim();
                                                                    if (newDesc !== (item.description || "")) {
                                                                        handleUpdateItem(item.id, container.id, { description: newDesc });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}

                                        {/* Add Item Form */}
                                        {newItemContainerId === container.id ? (
                                            <div className="flex gap-2 pt-2">
                                                <input
                                                    type="text"
                                                    value={newItemTitle}
                                                    onChange={(e) => setNewItemTitle(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleCreateItem(container.id)}
                                                    placeholder="Content title..."
                                                    className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm"
                                                    autoFocus
                                                />
                                                <select
                                                    value={newItemPriority}
                                                    onChange={(e) => setNewItemPriority(e.target.value as Priority)}
                                                    className="bg-card border border-border rounded-lg px-2 py-2 text-sm"
                                                >
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                </select>
                                                <button
                                                    onClick={() => handleCreateItem(container.id)}
                                                    disabled={!newItemTitle.trim()}
                                                    className="px-3 py-2 bg-primary text-black rounded-lg disabled:opacity-50"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setNewItemContainerId(null)}
                                                    className="px-3 py-2 border border-border rounded-lg hover:bg-card"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setNewItemContainerId(container.id)}
                                                className="w-full py-2 border border-dashed border-border rounded-lg text-muted
                                                    hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Item
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
