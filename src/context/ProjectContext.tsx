"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface Project {
    id: string;
    name: string;
    created_at: string;
}

interface ProjectContextType {
    currentProject: Project | null;
    projects: Project[];
    isLoading: boolean;
    selectProject: (project: Project) => void;
    refreshProjects: () => Promise<void>;
    createProject: (name: string) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    // Load projects and restore selection from localStorage
    useEffect(() => {
        const initAuthAndLoad = async () => {
            setIsLoading(true);
            try {
                // Check if user is logged in
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    console.log("Dev Mode: Auto-logging in...");
                    const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: 'dev@example.com',
                        password: 'password123'
                    });

                    if (signInError) {
                        console.error("Auto-login failed:", signInError);
                        // Optional: Create user if not exists (fallback)
                    }
                }

                await loadProjects();
            } catch (err) {
                console.error("Auth init error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        initAuthAndLoad();
    }, []);

    const loadProjects = async () => {
        // setIsLoading(true); // Handled in initAuthAndLoad
        try {
            const { data: projectsData, error } = await supabase
                .from("projects")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            setProjects(projectsData || []);

            // Restore selection or select first
            const savedProjectId = localStorage.getItem("currentProjectId");
            if (savedProjectId && projectsData) {
                const savedProject = projectsData.find((p) => p.id === savedProjectId);
                if (savedProject) {
                    setCurrentProject(savedProject);
                } else if (projectsData.length > 0) {
                    // If saved project not found (deleted?), select first
                    selectProject(projectsData[0]);
                }
            } else if (projectsData && projectsData.length > 0) {
                // No saved project, select first
                selectProject(projectsData[0]);
            }
        } catch (error) {
            console.error("Error loading projects:", error);
        }
    };

    const selectProject = (project: Project) => {
        setCurrentProject(project);
        localStorage.setItem("currentProjectId", project.id);
    };

    const refreshProjects = async () => {
        await loadProjects();
    };

    const createProject = async (name: string) => {
        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.user) throw new Error("No user found. Please wait for auto-login.");

            const { data, error } = await supabase
                .from("projects")
                .insert([{ name, user_id: user.user.id }])
                .select()
                .single();

            if (error) throw error;

            setProjects((prev) => [data, ...prev]);
            selectProject(data); // Auto-select new project
        } catch (error) {
            console.error("Error creating project:", error);
            throw error;
        }
    };

    const deleteProject = async (id: string) => {
        try {
            const { error } = await supabase.from("projects").delete().eq("id", id);
            if (error) throw error;

            const newProjects = projects.filter((p) => p.id !== id);
            setProjects(newProjects);

            if (currentProject?.id === id) {
                if (newProjects.length > 0) {
                    selectProject(newProjects[0]);
                } else {
                    setCurrentProject(null);
                    localStorage.removeItem("currentProjectId");
                }
            }
        } catch (error) {
            console.error("Error deleting project:", error);
            throw error;
        }
    };

    return (
        <ProjectContext.Provider
            value={{
                currentProject,
                projects,
                isLoading,
                selectProject,
                refreshProjects,
                createProject,
                deleteProject,
            }}
        >
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error("useProject must be used within a ProjectProvider");
    }
    return context;
}
