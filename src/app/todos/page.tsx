"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Settings, FolderPlus, Trash2, X, Loader2, ListTodo, Edit2, Check } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { TodoList as TodoListType, TodoItem as TodoItemType } from "@/lib/types";
import TodoListSidebar from "@/components/TodoListSidebar";
import TodoList from "@/components/TodoList";
import TodoSettingsModal from "@/components/TodoSettingsModal";
import TodoEditModal from "@/components/TodoEditModal";

export default function TodosPage() {
    const { currentProject, isLoading: projectLoading } = useProject();
    const [todoLists, setTodoLists] = useState<TodoListType[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [todoItems, setTodoItems] = useState<TodoItemType[]>([]);
    const [isLoadingLists, setIsLoadingLists] = useState(true);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [createWithFolder, setCreateWithFolder] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    // Edit modal state
    const [editingItem, setEditingItem] = useState<TodoItemType | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    // List rename state
    const [isRenamingList, setIsRenamingList] = useState(false);
    const [renameValue, setRenameValue] = useState("");

    // Sort lists: Main first, then incomplete, then completed at bottom
    const sortLists = useCallback((lists: TodoListType[]) => {
        return [...lists].sort((a, b) => {
            // Main list always first
            const aIsMain = a.name === "Main" && !a.folder_id;
            const bIsMain = b.name === "Main" && !b.folder_id;
            if (aIsMain && !bIsMain) return -1;
            if (!aIsMain && bIsMain) return 1;

            // Then sort by completion status (incomplete before completed)
            const aComplete = (a.items_count || 0) > 0 && a.completed_count === a.items_count;
            const bComplete = (b.items_count || 0) > 0 && b.completed_count === b.items_count;
            if (aComplete && !bComplete) return 1;
            if (!aComplete && bComplete) return -1;

            // Keep original order otherwise
            return 0;
        });
    }, []);

    // Fetch todo lists for current project
    const fetchTodoLists = useCallback(async () => {
        if (!currentProject?.id) return;

        setIsLoadingLists(true);
        try {
            const res = await fetch(`/api/todos?projectId=${currentProject.id}`);
            if (res.ok) {
                let data = await res.json();

                // Check if "Main" list exists, if not create it
                const mainList = data.find((l: TodoListType) => l.name === "Main" && !l.folder_id);
                if (!mainList) {
                    // Auto-create Main list
                    const createRes = await fetch("/api/todos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            project_id: currentProject.id,
                            name: "Main",
                            create_folder: false
                        })
                    });
                    if (createRes.ok) {
                        const newMainList = await createRes.json();
                        data = [newMainList, ...data];
                    }
                }

                setTodoLists(sortLists(data));
                // Auto-select first list if none selected
                if (data.length > 0 && !selectedListId) {
                    setSelectedListId(sortLists(data)[0].id);
                }
            }
        } catch (error) {
            console.error("Error fetching todo lists:", error);
        } finally {
            setIsLoadingLists(false);
        }
    }, [currentProject?.id, selectedListId]);

    // Fetch items for selected list
    const fetchTodoItems = useCallback(async () => {
        if (!selectedListId) return;

        setIsLoadingItems(true);
        try {
            const res = await fetch(`/api/todos/items?listId=${selectedListId}`);
            if (res.ok) {
                const data = await res.json();
                setTodoItems(data);

                // Recalculate and update list counts based on actual items
                const itemsCount = data.length;
                const completedCount = data.filter((i: TodoItemType) => i.completed).length;
                setTodoLists(prev => prev.map(l =>
                    l.id === selectedListId
                        ? { ...l, items_count: itemsCount, completed_count: completedCount }
                        : l
                ));
            }
        } catch (error) {
            console.error("Error fetching todo items:", error);
        } finally {
            setIsLoadingItems(false);
        }
    }, [selectedListId]);

    useEffect(() => {
        fetchTodoLists();
    }, [currentProject?.id]);

    useEffect(() => {
        if (selectedListId) {
            fetchTodoItems();
        } else {
            setTodoItems([]);
        }
    }, [selectedListId, fetchTodoItems]);

    // Create new list
    const handleCreateList = async () => {
        if (!newListName.trim() || !currentProject?.id) return;

        setIsCreating(true);
        try {
            const res = await fetch("/api/todos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: currentProject.id,
                    name: newListName.trim(),
                    create_folder: createWithFolder
                })
            });

            if (res.ok) {
                const newList = await res.json();
                setTodoLists([newList, ...todoLists]);
                setSelectedListId(newList.id);
                setNewListName("");
                setShowCreateModal(false);
            }
        } catch (error) {
            console.error("Error creating todo list:", error);
        } finally {
            setIsCreating(false);
        }
    };

    // Delete list
    const handleDeleteList = async () => {
        if (!selectedListId) return;

        if (!confirm("Delete this todo list? This cannot be undone.")) return;

        try {
            const res = await fetch(`/api/todos?id=${selectedListId}&deleteFolder=false`, {
                method: "DELETE"
            });

            if (res.ok) {
                const newLists = todoLists.filter((l) => l.id !== selectedListId);
                setTodoLists(newLists);
                setSelectedListId(newLists.length > 0 ? newLists[0].id : null);
            }
        } catch (error) {
            console.error("Error deleting todo list:", error);
        }
    };

    // Add item
    const handleAddItem = async (title: string) => {
        if (!selectedListId) return;

        try {
            const res = await fetch("/api/todos/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    todo_list_id: selectedListId,
                    title
                })
            });

            if (res.ok) {
                const newItem = await res.json();
                setTodoItems([...todoItems, newItem]);
                // Update list counts and re-sort
                setTodoLists(prev => {
                    const updated = prev.map((l) =>
                        l.id === selectedListId
                            ? { ...l, items_count: (l.items_count || 0) + 1 }
                            : l
                    );
                    return sortLists(updated);
                });
            }
        } catch (error) {
            console.error("Error adding item:", error);
        }
    };

    // Update item
    const handleUpdateItem = async (id: string, updates: Partial<TodoItemType>) => {
        try {
            const res = await fetch("/api/todos/items", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...updates })
            });

            if (res.ok) {
                const updatedItem = await res.json();
                setTodoItems(todoItems.map((i) => (i.id === id ? updatedItem : i)));

                // Update completed count if status changed
                if ("completed" in updates) {
                    setTodoLists(prev => {
                        const updated = prev.map((l) =>
                            l.id === selectedListId
                                ? {
                                    ...l,
                                    completed_count: updates.completed
                                        ? (l.completed_count || 0) + 1
                                        : Math.max(0, (l.completed_count || 0) - 1)
                                }
                                : l
                        );
                        return sortLists(updated);
                    });
                }
            }
        } catch (error) {
            console.error("Error updating item:", error);
        }
    };

    // Delete item
    const handleDeleteItem = async (id: string) => {
        try {
            const itemToDelete = todoItems.find((i) => i.id === id);
            const res = await fetch(`/api/todos/items?id=${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                setTodoItems(todoItems.filter((i) => i.id !== id));
                // Update list counts and re-sort
                setTodoLists(prev => {
                    const updated = prev.map((l) =>
                        l.id === selectedListId
                            ? {
                                ...l,
                                items_count: Math.max(0, (l.items_count || 0) - 1),
                                completed_count: itemToDelete?.completed
                                    ? Math.max(0, (l.completed_count || 0) - 1)
                                    : l.completed_count
                            }
                            : l
                    );
                    return sortLists(updated);
                });
            }
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };

    // Reorder items
    const handleReorderItems = async (items: { id: string; order_index: number }[]) => {
        // Optimistic update
        const reorderedItems = items.map((update) => {
            const item = todoItems.find((i) => i.id === update.id);
            return { ...item!, order_index: update.order_index };
        }).sort((a, b) => a.order_index - b.order_index);

        setTodoItems(reorderedItems);

        try {
            await fetch("/api/todos/items", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reorder: true, items })
            });
        } catch (error) {
            console.error("Error reordering items:", error);
            // Revert on error
            fetchTodoItems();
        }
    };

    // Open edit modal
    const handleEditItem = (item: TodoItemType) => {
        setEditingItem(item);
        setShowEditModal(true);
    };

    // Rename list
    const handleRenameList = async () => {
        if (!selectedListId || !renameValue.trim()) return;

        try {
            const res = await fetch("/api/todos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: selectedListId, name: renameValue.trim() })
            });

            if (res.ok) {
                setTodoLists(todoLists.map((l) =>
                    l.id === selectedListId ? { ...l, name: renameValue.trim() } : l
                ));
            }
        } catch (error) {
            console.error("Error renaming list:", error);
        }
        setIsRenamingList(false);
    };

    const selectedList = todoLists.find((l) => l.id === selectedListId);

    if (projectLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!currentProject) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-muted">
                <ListTodo className="w-16 h-16 mb-4 opacity-30" />
                <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
                <p>Please select a project to manage todo lists</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)]">
            {/* Sidebar */}
            <TodoListSidebar
                lists={todoLists}
                selectedListId={selectedListId}
                onSelectList={setSelectedListId}
                onCreateList={() => setShowCreateModal(true)}
                isLoading={isLoadingLists}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        {isRenamingList && selectedList ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleRenameList()}
                                    className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none"
                                    autoFocus
                                />
                                <button
                                    onClick={handleRenameList}
                                    className="p-1 rounded bg-primary text-black hover:bg-primary-hover"
                                >
                                    <Check className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setIsRenamingList(false)}
                                    className="p-1 rounded hover:bg-card"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <h1
                                className="text-2xl font-bold gradient-text cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                    if (selectedList) {
                                        setRenameValue(selectedList.name);
                                        setIsRenamingList(true);
                                    }
                                }}
                                title="Click to rename"
                            >
                                {selectedList?.name || "Todo Lists"}
                            </h1>
                        )}
                        <p className="text-sm text-muted mt-1">
                            {selectedList
                                ? `Managing tasks for "${selectedList.name}" (click title to rename)`
                                : "Select a list to view tasks"
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border
                                hover:bg-card hover:border-primary/30 transition-all text-muted hover:text-foreground"
                        >
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Default Tasks</span>
                        </button>
                        {selectedList && (
                            <button
                                onClick={handleDeleteList}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border
                                    hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-all text-muted"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Delete List</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Task List */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {selectedListId ? (
                        <TodoList
                            listId={selectedListId}
                            items={todoItems}
                            onAddItem={handleAddItem}
                            onUpdateItem={handleUpdateItem}
                            onDeleteItem={handleDeleteItem}
                            onEditItem={handleEditItem}
                            onReorderItems={handleReorderItems}
                            isLoading={isLoadingItems}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted">
                            <ListTodo className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-lg">Select a list or create a new one</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="mt-4 flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-lg font-medium
                                    hover:bg-primary-hover transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                Create Todo List
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create List Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowCreateModal(false)}
                    />
                    <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-card-hover transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <FolderPlus className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">New Todo List</h2>
                                <p className="text-sm text-muted">Create a new task list</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">List Name</label>
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                                    placeholder="e.g., Sprint Tasks, Bug Fixes..."
                                    className="w-full bg-background border border-border rounded-lg px-4 py-3
                                        focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none"
                                    autoFocus
                                />
                            </div>

                            <label className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border cursor-pointer hover:border-primary/30 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={createWithFolder}
                                    onChange={(e) => setCreateWithFolder(e.target.checked)}
                                    className="w-4 h-4 accent-primary"
                                />
                                <div>
                                    <span className="font-medium">Create project folder</span>
                                    <p className="text-xs text-muted">Sync this list with a new folder</p>
                                </div>
                            </label>

                            <button
                                onClick={handleCreateList}
                                disabled={!newListName.trim() || isCreating}
                                className="w-full py-3 bg-primary text-black rounded-lg font-semibold
                                    hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-all flex items-center justify-center gap-2"
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        Create List
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            <TodoSettingsModal
                projectId={currentProject.id}
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />

            {/* Edit Task Modal */}
            <TodoEditModal
                item={editingItem}
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                }}
                onSave={handleUpdateItem}
                onDelete={handleDeleteItem}
            />
        </div>
    );
}
