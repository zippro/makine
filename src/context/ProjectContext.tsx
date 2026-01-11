"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";

import { Project } from "@/lib/types";

interface ProjectContextType {
    currentProject: Project | null;
    projects: Project[];
    isLoading: boolean;
    user: User | null;
    selectProject: (project: Project) => void;
    refreshProjects: () => Promise<void>;
    createProject: (name: string) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const supabase = createClient();
    const pathname = usePathname();

    const loadProjects = async () => {
        try {
            const { data: projectsData, error } = await supabase
                .from("projects")
                .select("*, video_mode, template_assets, overlay_config")
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
                    setCurrentProject(projectsData[0]);
                    localStorage.setItem("currentProjectId", projectsData[0].id);
                }
            } else if (projectsData && projectsData.length > 0) {
                setCurrentProject(projectsData[0]);
                localStorage.setItem("currentProjectId", projectsData[0].id);
            }
        } catch (error) {
            console.error("Error loading projects:", error);
        }
    };

    // Simplified auth initialization
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!mounted) return;

                setUser(session?.user ?? null);

                if (!session) {
                    // Not logged in
                    if (pathname !== '/login') {
                        window.location.href = '/login';
                        return;
                    }
                    setIsLoading(false);
                    return;
                }

                // Logged in - load projects
                await loadProjects();
                if (mounted) {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Auth init error:", err);
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        // Listen for auth changes (logout/login from other tabs)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;

            setUser(session?.user ?? null);

            if (event === 'SIGNED_OUT') {
                setCurrentProject(null);
                setProjects([]);
                window.location.href = '/login';
            }
            // Note: We dont handle SIGNED_IN here to avoid double work
            // The login page already does a hard redirect after successful login
        });

        initAuth();

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [pathname]);

    const selectProject = (project: Project) => {
        setCurrentProject(project);
        localStorage.setItem("currentProjectId", project.id);
    };

    const refreshProjects = async () => {
        await loadProjects();
    };

    const createProject = async (name: string) => {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error("No user found.");

            const { data, error } = await supabase
                .from("projects")
                .insert([{ name, user_id: userData.user.id }])
                .select()
                .single();

            if (error) throw error;

            // Create default folders in background (don't await)
            const defaultFolders = ['/Animation', '/Image', '/Music'];
            Promise.all(defaultFolders.map(path =>
                fetch('/api/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_id: data.id, path })
                }).catch(err => console.error(`Failed to create folder ${path}`, err))
            ));

            setProjects((prev) => [data, ...prev]);
            selectProject(data);
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

    const updateProject = async (id: string, updates: Partial<Project>) => {
        try {
            const { data, error } = await supabase
                .from("projects")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;

            setProjects((prev) => prev.map((p) => (p.id === id ? data : p)));
            if (currentProject?.id === id) {
                setCurrentProject(data);
            }
        } catch (error) {
            console.error("Error updating project:", error);
            throw error;
        }
    };

    // Reduced safety timeout (3 seconds instead of 8)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoading) {
                console.warn("Forcing loading completion after timeout");
                setIsLoading(false);
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [isLoading]);

    // Show loading only for protected pages, not login
    if (isLoading && pathname !== '/login') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    {/* Simple spinner - faster to render */}
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-lg text-zinc-400">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <ProjectContext.Provider
            value={{
                currentProject,
                projects,
                isLoading,
                user,
                selectProject,
                refreshProjects,
                createProject,
                deleteProject,
                updateProject,
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
