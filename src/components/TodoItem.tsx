"use client";

import { useState, useRef } from "react";
import { Check, GripVertical, Trash2, Calendar, ChevronDown, Edit2 } from "lucide-react";
import { TodoItem as TodoItemType, Priority } from "@/lib/types";

interface TodoItemProps {
    item: TodoItemType;
    onUpdate: (id: string, updates: Partial<TodoItemType>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onEdit: (item: TodoItemType) => void;
    onDragStart: (e: React.DragEvent, item: TodoItemType) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, targetItem: TodoItemType) => void;
    isDragging?: boolean;
}

const priorityColors: Record<Priority, string> = {
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30"
};

const priorityLabels: Record<Priority, string> = {
    low: "Low",
    medium: "Medium",
    high: "High"
};

export default function TodoItem({
    item,
    onUpdate,
    onDelete,
    onEdit,
    onDragStart,
    onDragOver,
    onDrop,
    isDragging
}: TodoItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title);
    const [showPriorityMenu, setShowPriorityMenu] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleToggleComplete = async () => {
        setIsUpdating(true);
        await onUpdate(item.id, { completed: !item.completed });
        setIsUpdating(false);
    };

    const handleTitleSave = async () => {
        if (editTitle.trim() && editTitle !== item.title) {
            setIsUpdating(true);
            await onUpdate(item.id, { title: editTitle.trim() });
            setIsUpdating(false);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleTitleSave();
        } else if (e.key === "Escape") {
            setEditTitle(item.title);
            setIsEditing(false);
        }
    };

    const handlePriorityChange = async (priority: Priority) => {
        setIsUpdating(true);
        await onUpdate(item.id, { priority });
        setShowPriorityMenu(false);
        setIsUpdating(false);
    };

    const handleDueDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsUpdating(true);
        await onUpdate(item.id, { due_date: e.target.value || undefined });
        setIsUpdating(false);
    };

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, item)}
            className={`group relative flex items-center gap-3 p-3 bg-card rounded-lg border border-border 
                hover:border-primary/30 transition-all duration-200 cursor-grab active:cursor-grabbing
                ${isDragging ? "opacity-50 scale-95" : ""}
                ${item.completed ? "opacity-60" : ""}`}
        >
            {/* Drag Handle */}
            <div className="cursor-grab active:cursor-grabbing text-muted hover:text-foreground transition-colors">
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Checkbox */}
            <button
                onClick={handleToggleComplete}
                disabled={isUpdating}
                className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200
                    ${item.completed
                        ? "bg-primary border-primary"
                        : "border-border hover:border-primary/50"
                    }`}
            >
                {item.completed && <Check className="w-3 h-3 text-black" />}
            </button>

            {/* Title */}
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleTitleSave}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent border-b border-primary outline-none text-foreground"
                        autoFocus
                    />
                ) : (
                    <span
                        onClick={() => {
                            setIsEditing(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className={`block truncate cursor-text hover:text-primary transition-colors
                            ${item.completed ? "line-through text-muted" : ""}`}
                    >
                        {item.title}
                    </span>
                )}
            </div>

            {/* Priority Badge */}
            <div className="relative">
                <button
                    onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors
                        ${priorityColors[item.priority]}`}
                >
                    {priorityLabels[item.priority]}
                    <ChevronDown className="w-3 h-3" />
                </button>

                {showPriorityMenu && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowPriorityMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 py-1 min-w-[100px]">
                            {(["low", "medium", "high"] as Priority[]).map((priority) => (
                                <button
                                    key={priority}
                                    onClick={() => handlePriorityChange(priority)}
                                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-primary/10 transition-colors
                                        ${item.priority === priority ? "text-primary" : "text-foreground"}`}
                                >
                                    {priorityLabels[priority]}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Due Date */}
            <div className="relative group/date">
                <input
                    type="date"
                    value={item.due_date || ""}
                    onChange={handleDueDateChange}
                    className={`w-8 h-8 rounded-md bg-transparent cursor-pointer opacity-0 absolute inset-0`}
                />
                <div className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors
                    ${item.due_date
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:text-foreground hover:bg-card-hover"
                    }`}
                >
                    <Calendar className="w-4 h-4" />
                </div>
                {item.due_date && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted whitespace-nowrap">
                        {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                )}
            </div>

            {/* Edit Button */}
            <button
                onClick={() => onEdit(item)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-primary transition-all p-1 rounded hover:bg-primary/10"
                title="Edit task"
            >
                <Edit2 className="w-4 h-4" />
            </button>

            {/* Delete Button */}
            <button
                onClick={() => onDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all p-1 rounded hover:bg-red-500/10"
                title="Delete task"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}
