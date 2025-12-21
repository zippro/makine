"use client";

import { useState, useEffect } from "react";
import { ProjectConfigModal } from '@/components/ProjectConfigModal';
import { useProject } from "@/context/ProjectContext";
import { Project } from "@/lib/types";
import { Plus, Trash2, FolderOpen, Settings, Youtube, X } from "lucide-react";

export default function ProjectsPage() {
    const { projects, createProject, deleteProject, updateProject, selectProject, refreshProjects, currentProject, isLoading } =
        useProject();
    const [newProjectName, setNewProjectName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingProject, setEditingProject] = useState<Project | null>(null);


    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;

        setIsCreating(true);
        setError(null);
        try {
            await createProject(newProjectName);
            setNewProjectName("");
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold gradient-text">Projects</h1>
                <p className="text-muted-foreground">
                    Manage your creative projects. All resources (music, images, animations)
                    are scoped to a specific project.
                </p>

            </div>

            {/* Create New Project */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" /> Create New Project
                </h2>
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                        {error}
                    </div>
                )}
                <form onSubmit={handleCreate} className="flex gap-4">
                    <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Project Name (e.g. Summer Vibe 2025)"
                        className="flex-1 bg-background border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!newProjectName.trim() || isCreating}
                        className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 
                            ${!newProjectName.trim() || isCreating
                                ? "bg-primary/20 text-primary/40 cursor-not-allowed border border-primary/10"
                                : "bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 hover:scale-105"
                            }`}
                    >
                        {isCreating ? "Creating..." : "Create"}
                    </button>
                </form>
            </div>

            {/* Projects List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-dashed border-border">
                        No projects found. Create your first project above!
                    </div>
                ) : (
                    projects.map((project) => (
                        <div
                            key={project.id}
                            className={`relative group bg-card rounded-xl p-6 border transition-all ${currentProject?.id === project.id
                                ? "border-primary shadow-md shadow-primary/10"
                                : "border-border hover:border-primary/50"
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div
                                    className="cursor-pointer flex-1"
                                    onClick={() => selectProject(project)}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <FolderOpen className={`w-5 h-5 ${currentProject?.id === project.id ? "text-primary" : "text-muted-foreground"
                                            }`} />
                                        <h3 className="font-semibold text-lg">{project.name}</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Created: {new Date(project.created_at).toLocaleDateString()}
                                    </p>
                                    {currentProject?.id === project.id && (
                                        <span className="inline-block mt-3 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                                            Active
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProject(project);
                                    }}
                                    className="text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-primary/10 transition-colors"
                                    title="YouTube Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("Are you sure? All resources in this project will be hidden (or deleted depending on policy).")) {
                                            deleteProject(project.id);
                                        }
                                    }}
                                    className="text-muted-foreground hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                    title="Delete Project"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Project Config Modal */}
            {editingProject && (
                <ProjectConfigModal
                    project={editingProject}
                    isOpen={!!editingProject}
                    onClose={() => setEditingProject(null)}
                    onUpdate={(updated) => {
                        refreshProjects();
                    }}
                />
            )}
        </div>
    );
}
