"use client";

import { useState, useEffect } from "react";
import { Loader2, Folder, X, Check } from "lucide-react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useProject } from "@/context/ProjectContext";

interface MoveAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentFolder: string;
    onMove: (targetFolder: string) => Promise<void>;
    assetType: "video" | "project" | "animation" | "music" | "image" | "file";
}

export function MoveAssetModal({ isOpen, onClose, currentFolder, onMove, assetType = 'file' }: MoveAssetModalProps) {
    useEscapeKey(onClose);
    const { currentProject } = useProject();
    const [loading, setLoading] = useState(false);
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [isMoving, setIsMoving] = useState(false);

    useEffect(() => {
        if (isOpen && currentProject) {
            setLoading(true);
            fetch(`/ api / folders ? projectId = ${currentProject.id} `)
                .then(res => res.json())
                .then(data => {
                    setFolders(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch folders", err);
                    setLoading(false);
                });
        }
    }, [isOpen, currentProject]);

    const handleMove = async () => {
        if (!selectedFolder) return;
        setIsMoving(true);
        try {
            await onMove(selectedFolder);
            onClose();
        } catch (err) {
            console.error("Move failed", err);
            alert("Failed to move asset");
        } finally {
            setIsMoving(false);
        }
    };

    if (!isOpen) return null;

    // Filter out current folder if needed, or just show all
    // Also include root folder '/'
    const allFolders = [{ path: '/', name: 'Root' }, ...folders];

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl max-w-sm w-full flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold">Move {assetType}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="p-4 text-center text-muted">Loading folders...</div>
                    ) : (
                        allFolders.map(folder => (
                            <button
                                key={folder.path}
                                onClick={() => setSelectedFolder(folder.path)}
                                className={`w - full flex items - center gap - 3 px - 3 py - 2 rounded - lg transition - colors ${selectedFolder === folder.path
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-muted text-foreground"
                                    } `}
                                disabled={folder.path === currentFolder}
                            >
                                <Folder className={`w - 4 h - 4 ${selectedFolder === folder.path ? "fill-primary" : ""} `} />
                                <span className="flex-1 text-left truncate">
                                    {folder.path === '/' ? 'Root Folder' : folder.path}
                                </span>
                                {selectedFolder === folder.path && <Check className="w-4 h-4" />}
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-border">
                    <button
                        onClick={handleMove}
                        disabled={!selectedFolder || isMoving || selectedFolder === currentFolder}
                        className="w-full btn-primary py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isMoving ? "Moving..." : "Move Here"}
                    </button>
                </div>
            </div>
        </div>
    );
}
