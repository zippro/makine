"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video, History, Upload, Image, Music, FolderOpen, Home, ChevronRight, Clapperboard } from "lucide-react";
import { useProject } from "@/context/ProjectContext";

export default function Navigation() {
    const pathname = usePathname();
    const { currentProject, isLoading } = useProject();

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

                        {/* Project Indicator */}
                        {!isLoading && currentProject && (
                            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-secondary/50 rounded-full border border-border text-sm text-muted-foreground animate-in fade-in">
                                <span className="opacity-50">/</span>
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span className="font-medium text-foreground truncate max-w-[150px]">
                                    {currentProject.name}
                                </span>
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
