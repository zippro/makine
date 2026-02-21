"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Video, History, Image, Music, FolderOpen, Home, Clapperboard, ChevronDown, Check, ListTodo, LogOut, User, Upload, Bot, HardDrive, Sparkles, BarChart3 } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { createClient } from "@/lib/supabase/client";
import AISettingsModal from "@/components/AISettingsModal";

export default function Navigation() {
    const pathname = usePathname();
    const router = useRouter();
    const { currentProject, projects, selectProject, isLoading, user } = useProject();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCreatorOpen, setIsCreatorOpen] = useState(false);
    const [isProducerOpen, setIsProducerOpen] = useState(false);
    const [isDeployOpen, setIsDeployOpen] = useState(false);
    const [nickname, setNickname] = useState<string | null>(null);
    const [mentionCount, setMentionCount] = useState(0);
    const [showAISettings, setShowAISettings] = useState(false);
    const supabase = createClient();

    const isCreatorActive = pathname?.startsWith("/creator");
    const isProducerActive = pathname === "/upload-images" || pathname === "/music-library" || pathname === "/animations";
    const isDeployActive = pathname === "/create-video";

    // Fetch user nickname and mention count
    useEffect(() => {
        if (user) {
            fetch('/api/profile')
                .then(res => res.json())
                .then(data => {
                    if (data.nickname) setNickname(data.nickname);
                })
                .catch(() => { });

            // Fetch pending mentions count
            fetch('/api/profile/mentions')
                .then(res => res.json())
                .then(data => {
                    if (data.items) {
                        const pending = data.items.filter((item: any) => !item.completed).length;
                        setMentionCount(pending);
                    }
                })
                .catch(() => { });
        }
    }, [user]);

    const isActive = (path: string) => pathname === path;

    if (pathname === '/login') return null;

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

                    <div className="flex items-center gap-0.5 sm:gap-1">
                        <Link
                            href="/"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <Home className="h-4 w-4" />
                            <span className="hidden md:inline">Home</span>
                        </Link>

                        <Link
                            href="/todos"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/todos")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <ListTodo className="h-4 w-4" />
                            <span className="hidden md:inline">Todos</span>
                        </Link>

                        <div className="h-4 w-px bg-border mx-1" />

                        {/* Creator Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => { setIsCreatorOpen(!isCreatorOpen); setIsProducerOpen(false); setIsDeployOpen(false); }}
                                className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isCreatorActive
                                    ? "bg-purple-500/10 text-purple-400 font-medium"
                                    : "text-muted hover:text-purple-400 hover:bg-card"
                                    }`}
                            >
                                <Sparkles className="h-4 w-4" />
                                <span className="hidden lg:inline">Creator</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${isCreatorOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isCreatorOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsCreatorOpen(false)} />
                                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-2">
                                        <Link href="/creator/image" onClick={() => setIsCreatorOpen(false)}
                                            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${pathname?.startsWith("/creator/image")
                                                ? "bg-purple-500/10 text-purple-400 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-card-hover"}`}
                                        >
                                            <Sparkles className="h-4 w-4" /> AI Image
                                        </Link>
                                        <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed">
                                            <Music className="h-4 w-4" /> AI Music
                                            <span className="ml-auto text-[10px] bg-white/5 px-1.5 py-0.5 rounded-full">Soon</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Producer Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => { setIsProducerOpen(!isProducerOpen); setIsCreatorOpen(false); setIsDeployOpen(false); }}
                                className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isProducerActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted hover:text-foreground hover:bg-card"
                                    }`}
                            >
                                <FolderOpen className="h-4 w-4" />
                                <span className="hidden lg:inline">Producer</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${isProducerOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isProducerOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsProducerOpen(false)} />
                                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-2">
                                        <Link href="/upload-images" onClick={() => setIsProducerOpen(false)}
                                            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isActive("/upload-images")
                                                ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-card-hover"}`}
                                        >
                                            <Image className="h-4 w-4" /> Images
                                        </Link>
                                        <Link href="/music-library" onClick={() => setIsProducerOpen(false)}
                                            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isActive("/music-library")
                                                ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-card-hover"}`}
                                        >
                                            <Music className="h-4 w-4" /> Music
                                        </Link>
                                        <Link href="/animations" onClick={() => setIsProducerOpen(false)}
                                            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isActive("/animations")
                                                ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-card-hover"}`}
                                        >
                                            <Video className="h-4 w-4" /> Animations
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="h-4 w-px bg-border mx-1" />

                        {/* Deploy Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => { setIsDeployOpen(!isDeployOpen); setIsCreatorOpen(false); }}
                                className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isDeployActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted hover:text-foreground hover:bg-card"
                                    }`}
                            >
                                <Clapperboard className="h-4 w-4" />
                                <span className="hidden lg:inline">Deploy</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${isDeployOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDeployOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDeployOpen(false)} />
                                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-2">
                                        <Link href="/create-video" onClick={() => setIsDeployOpen(false)}
                                            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isActive("/create-video")
                                                ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-card-hover"}`}
                                        >
                                            <Clapperboard className="h-4 w-4" /> YouTube Video
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>

                        <Link
                            href="/history"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/history")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <History className="h-4 w-4" />
                            <span className="hidden lg:inline">History</span>
                        </Link>

                        <Link
                            href="/publish"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/publish")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <Upload className="h-4 w-4" />
                            <span className="hidden lg:inline">Publish</span>
                        </Link>

                        <Link
                            href="/analytics"
                            className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/analytics")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted hover:text-foreground hover:bg-card"
                                }`}
                        >
                            <BarChart3 className="h-4 w-4" />
                            <span className="hidden lg:inline">Analytics</span>
                        </Link>

                        <div className="h-4 w-px bg-border mx-1" />

                        <a
                            href={`https://${process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244'}.nip.io/browse/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors text-muted hover:text-foreground hover:bg-card"
                            title="Server Storage"
                        >
                            <HardDrive className="h-4 w-4" />
                        </a>

                        <div className="h-4 w-px bg-border mx-1" />

                        {user?.email && (
                            <>
                                <Link
                                    href="/profile"
                                    className={`relative flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm transition-colors ${isActive("/profile")
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted hover:text-foreground hover:bg-card"
                                        }`}
                                    title="Profile"
                                >
                                    {nickname === 'sincap' ? (
                                        <span className="text-base">🐿️</span>
                                    ) : nickname === 'mirket' ? (
                                        <span className="text-base">🦦</span>
                                    ) : (
                                        <User className="h-4 w-4" />
                                    )}
                                    {nickname && <span className="hidden md:inline text-primary">@{nickname}</span>}
                                    {mentionCount > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                                            {mentionCount > 99 ? '99+' : mentionCount}
                                        </span>
                                    )}
                                </Link>
                            </>
                        )}

                        <button
                            onClick={async () => {
                                try {
                                    // 1. Client-side cleanup (just in case)
                                    localStorage.clear();

                                    // 2. Server-side cleanup (The real fix)
                                    // We use a fetch to trigger the server route which clears cookies
                                    // Using POST to stick to semantics for state change
                                    const response = await fetch('/auth/signout', {
                                        method: 'POST',
                                    });

                                    if (response.redirected) {
                                        window.location.href = response.url;
                                    } else {
                                        window.location.href = '/login';
                                    }
                                } catch (e) {
                                    console.error("Logout error:", e);
                                    window.location.href = '/login';
                                }
                            }}
                            className="flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm text-muted hover:text-red-400 hover:bg-card transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>

                        {/* AI Settings Button */}
                        <button
                            onClick={() => setShowAISettings(true)}
                            className="flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-sm text-muted hover:text-purple-400 hover:bg-card transition-colors"
                            title="AI Settings"
                        >
                            <Bot className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Settings Modal */}
            <AISettingsModal isOpen={showAISettings} onClose={() => setShowAISettings(false)} />
        </nav>
    );
}
