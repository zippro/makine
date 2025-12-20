"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video, History, Image, Music, FolderOpen, Home, Clapperboard, ChevronDown, Check } from "lucide-react";
import { useProject } from "@/context/ProjectContext";

export default function Navigation() {
    const pathname = usePathname();
    const { currentProject, projects, selectProject, isLoading } = useProject();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2">
                            <Clapperboard className="h-6 w-6 text-primary" />
                            <span className="text-lg font-semibold gradient-text hidden md:inline">
                                Makine
                            </span>
                        </Link>

                        {/* Project Switcher Dropdown */}
                        {!isLoading && currentProject && (
                            <div className="relative hidden md:block">
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full border border-border text-sm text-muted-foreground hover:border-primary/50 hover:bg-secondary transition-all"
                                >
                                    <span className="opacity-50">/</span>
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span className="font-medium text-foreground truncate max-w-[150px]">
                                        {currentProject.name}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Menu */}
                                {isDropdownOpen && (
                                    <>
                                        {/* Backdrop */}
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsDropdownOpen(false)}
                                        />

                                        {/* Menu */}
                                        <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="px-3 py-1.5 text-xs text-muted uppercase tracking-wide">
                                                Switch Project
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {projects.map((project) => (
                                                    <button
                                                        key={project.id}
                                                        onClick={() => {
                                                            selectProject(project);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/10 transition-colors ${currentProject.id === project.id ? 'bg-primary/5' : ''
                                                            }`}
                                                    >
                                                        <FolderOpen className={`w-4 h-4 ${currentProject.id === project.id ? 'text-primary' : 'text-muted'}`} />
                                                        <span className={`flex-1 truncate ${currentProject.id === project.id ? 'text-primary font-medium' : 'text-foreground'}`}>
                                                            {project.name}
                                                        </span>
                                                        {currentProject.id === project.id && (
                                                            <Check className="w-4 h-4 text-primary" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="border-t border-border mt-2 pt-2 px-3">
                                                <Link
                                                    href="/projects"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                    className="block text-sm text-primary hover:underline"
                                                >
                                                    Manage Projects →
                                                </Link>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        <Link
                            href="/"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <Home className="h-4 w-4" />
                            <span className="hidden sm:inline">Home</span>
                        </Link>

                        <Link
                            href="/projects"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/projects")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <FolderOpen className="h-4 w-4" />
                            <span className="hidden sm:inline">Projects</span>
                        </Link>

                        <div className="h-4 w-px bg-border mx-1" />

                        <Link
                            href="/upload-images"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/upload-images")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <Image className="h-4 w-4" />
                            <span className="hidden sm:inline">Images</span>
                        </Link>

                        <Link
                            href="/music-library"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/music-library")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <Music className="h-4 w-4" />
                            <span className="hidden sm:inline">Music</span>
                        </Link>

                        <Link
                            href="/animations"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/animations")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <Video className="h-4 w-4" />
                            <span className="hidden sm:inline">Animations</span>
                        </Link>

                        <Link
                            href="/history"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/history")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <History className="h-4 w-4" />
                            <span className="hidden sm:inline">History</span>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
