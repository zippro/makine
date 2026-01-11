"use client";

import { useState, useCallback } from "react";
import { Plus, Filter, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { TodoItem as TodoItemType, Priority } from "@/lib/types";
import TodoItem from "./TodoItem";

interface TodoListProps {
    listId: string;
    items: TodoItemType[];
    onAddItem: (title: string) => Promise<void>;
    onUpdateItem: (id: string, updates: Partial<TodoItemType>) => Promise<void>;
    onDeleteItem: (id: string) => Promise<void>;
    onEditItem: (item: TodoItemType) => void;
    onReorderItems: (items: { id: string; order_index: number }[]) => Promise<void>;
    isLoading?: boolean;
}

type FilterType = "all" | "active" | "completed";

export default function TodoList({
    listId,
    items,
    onAddItem,
    onUpdateItem,
    onDeleteItem,
    onEditItem,
    onReorderItems,
    isLoading
}: TodoListProps) {
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [filter, setFilter] = useState<FilterType>("all");
    const [draggedItem, setDraggedItem] = useState<TodoItemType | null>(null);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        setIsAdding(true);
        await onAddItem(newTaskTitle.trim());
        setNewTaskTitle("");
        setIsAdding(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleAddTask(e as any);
        }
    };

    const filteredItems = items.filter((item) => {
        if (filter === "active") return !item.completed;
        if (filter === "completed") return item.completed;
        return true;
    });

    // Sort: uncompleted first (by order), then completed (by order)
    const sortedItems = [...filteredItems].sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return a.order_index - b.order_index;
    });

    const handleDragStart = useCallback((e: React.DragEvent, item: TodoItemType) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, targetItem: TodoItemType) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.id === targetItem.id) {
            setDraggedItem(null);
            return;
        }

        // Calculate new order
        const oldIndex = items.findIndex((i) => i.id === draggedItem.id);
        const newIndex = items.findIndex((i) => i.id === targetItem.id);

        if (oldIndex === -1 || newIndex === -1) {
            setDraggedItem(null);
            return;
        }

        // Create new order
        const reorderedItems = [...items];
        const [removed] = reorderedItems.splice(oldIndex, 1);
        reorderedItems.splice(newIndex, 0, removed);

        // Update order_index for all items
        const updates = reorderedItems.map((item, index) => ({
            id: item.id,
            order_index: index
        }));

        await onReorderItems(updates);
        setDraggedItem(null);
    }, [draggedItem, items, onReorderItems]);

    const completedCount = items.filter((i) => i.completed).length;
    const totalCount = items.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <div className="flex flex-col h-full">
            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted">Progress</span>
                    <span className="text-foreground font-medium">
                        {completedCount} / {totalCount} tasks
                    </span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden border border-border">
                    <div
                        className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Add Task Form */}
            <form onSubmit={handleAddTask} className="mb-6">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Add a new task... (Press Enter)"
                            className="w-full bg-card border border-border rounded-lg px-4 py-3 pr-12
                                focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none
                                transition-all placeholder:text-muted"
                        />
                        <button
                            type="submit"
                            disabled={!newTaskTitle.trim() || isAdding}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg
                                bg-primary text-black hover:bg-primary-hover disabled:opacity-50
                                disabled:cursor-not-allowed transition-all"
                        >
                            {isAdding ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                <span className="text-sm text-muted mr-2">
                    <Filter className="w-4 h-4 inline mr-1" />
                    Filter:
                </span>
                {(["all", "active", "completed"] as FilterType[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                            ${filter === f
                                ? "bg-primary text-black"
                                : "text-muted hover:text-foreground hover:bg-card"
                            }`}
                    >
                        {f === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {f === "active" && <Circle className="w-3.5 h-3.5" />}
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className="opacity-60">
                            ({f === "all"
                                ? totalCount
                                : f === "completed"
                                    ? completedCount
                                    : totalCount - completedCount
                            })
                        </span>
                    </button>
                ))}
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : sortedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted">
                        <CheckCircle2 className="w-12 h-12 mb-3 opacity-30" />
                        <p>
                            {filter === "all"
                                ? "No tasks yet. Add one above!"
                                : filter === "active"
                                    ? "No active tasks. Great job!"
                                    : "No completed tasks yet."}
                        </p>
                    </div>
                ) : (
                    sortedItems.map((item) => (
                        <TodoItem
                            key={item.id}
                            item={item}
                            onUpdate={onUpdateItem}
                            onDelete={onDeleteItem}
                            onEdit={onEditItem}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            isDragging={draggedItem?.id === item.id}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
