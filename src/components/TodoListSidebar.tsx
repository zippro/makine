"use client";

import { Plus, FolderOpen, CheckCircle2, Loader2, Home } from "lucide-react";
import { TodoList as TodoListType } from "@/lib/types";

interface TodoListSidebarProps {
    lists: TodoListType[];
    selectedListId: string | null;
    onSelectList: (listId: string) => void;
    onCreateList: () => void;
    isLoading?: boolean;
}

export default function TodoListSidebar({
    lists,
    selectedListId,
    onSelectList,
    onCreateList,
    isLoading
}: TodoListSidebarProps) {
    return (
        <div className="w-72 flex-shrink-0 bg-card/50 border-r border-border flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-lg">Todo Lists</h2>
                    <button
                        onClick={onCreateList}
                        className="p-2 rounded-lg bg-primary text-black hover:bg-primary-hover transition-all"
                        title="Create new list"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-muted">
                    Each list syncs with a project folder
                </p>
            </div>

            {/* Lists */}
            <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : lists.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No todo lists yet</p>
                        <p className="text-xs mt-1">Create one to get started</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {lists.map((list) => {
                            const itemsCount = list.items_count || 0;
                            const completedCount = list.completed_count || 0;
                            const progress = itemsCount > 0 ? (completedCount / itemsCount) * 100 : 0;
                            const isSelected = selectedListId === list.id;
                            const isMainList = list.name === "Main" && !list.folder_id;

                            return (
                                <button
                                    key={list.id}
                                    onClick={() => onSelectList(list.id)}
                                    className={`w-full p-3 rounded-lg text-left transition-all group
                                        ${isSelected
                                            ? "bg-primary/10 border border-primary/30"
                                            : "hover:bg-card border border-transparent hover:border-border"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-md transition-colors
                                            ${isMainList
                                                ? isSelected ? "bg-yellow-500/20" : "bg-yellow-500/10 group-hover:bg-yellow-500/20"
                                                : isSelected ? "bg-primary/20" : "bg-card group-hover:bg-primary/10"
                                            }`}
                                        >
                                            {isMainList ? (
                                                <Home className={`w-4 h-4 ${isSelected ? "text-yellow-500" : "text-yellow-500/70"}`} />
                                            ) : (
                                                <FolderOpen className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted"}`} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className={`truncate ${isMainList ? "font-bold" : "font-medium"} ${isSelected ? isMainList ? "text-yellow-500" : "text-primary" : ""}`}>
                                                    {list.name}
                                                </span>
                                                {itemsCount > 0 && (
                                                    <span className="text-xs text-muted ml-2">
                                                        {completedCount}/{itemsCount}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Progress bar */}
                                            {itemsCount > 0 && (
                                                <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-300
                                                            ${progress === 100
                                                                ? "bg-green-500"
                                                                : "bg-primary opacity-60"
                                                            }`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {progress === 100 && itemsCount > 0 && (
                                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
