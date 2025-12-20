'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Wand2, Upload, Music, Type, Loader2, GripVertical, X, Plus, AlertCircle, FolderOpen, Video, Settings, Check } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { createClient } from '@/lib/supabase/client';
import { ProjectConfigModal } from '@/components/ProjectConfigModal';
import { AssetPlaylistEditor } from '@/components/AssetPlaylistEditor';
import { Project } from '@/lib/types';

interface Animation {
  id: string;
  url: string | null;
  duration: number;
  is_approved: boolean;
  video_usage_count: number;
  images: { url: string; filename: string } | null;
}

interface MusicTrack {
  id: string;
  url: string;
  filename: string;
  duration_seconds: number | null;
  video_usage_count: number;
}

export default function Home() {
  const router = useRouter();
  const { currentProject, projects, selectProject, createProject, refreshProjects } = useProject();
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [musicLibrary, setMusicLibrary] = useState<MusicTrack[]>([]);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);

  // Simple Form State
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState<string>('');
  const [title, setTitle] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [draggedMusicIndex, setDraggedMusicIndex] = useState<number | null>(null);

  // Load Data - Project Scoped (with backwards compatibility for legacy items)
  useEffect(() => {
    if (!currentProject) return;

    const fetchData = async () => {
      const supabase = createClient();

      // Get animations: project-scoped OR legacy (null project_id)
      const { data: anims } = await supabase
        .from('animations')
        .select('*, images(*)')
        .eq('is_approved', true)
        .or(`project_id.eq.${currentProject.id},project_id.is.null`)
        .order('video_usage_count', { ascending: false });

      // Get music: project-scoped OR legacy (null project_id)  
      const { data: music } = await supabase
        .from('music_library')
        .select('*')
        .or(`project_id.eq.${currentProject.id},project_id.is.null`)
        .order('video_usage_count', { ascending: false });

      if (anims) setAnimations(anims);
      if (music) setMusicLibrary(music);
    };

    fetchData();
  }, [currentProject]);

  const handleMusicSelect = (track: MusicTrack) => {
    setSelectedMusic(prev => {
      const exists = prev.find(t => t.id === track.id);
      if (exists) {
        return prev.filter(t => t.id !== track.id);
      }
      return [...prev, track];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    /* if (!imageUrl && !imageFile) {
      setError('Please select an image');
      return;
    } */
    if (selectedMusic.length === 0) {
      setError('Please select at least one music track');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a video title');
      return;
    }
    const mode = (currentProject as any)?.video_mode || 'simple_animation';
    if (mode === 'simple_animation' && !selectedAnimation && animations.length > 0) {
      setError('Please select an animation style');
      return;
    }
    if (mode !== 'simple_animation' && (!((currentProject as any)?.template_assets) || (currentProject as any).template_assets.length === 0)) {
      setError('Please add items to the playlist in Project Settings');
      return;
    }
    if (!currentProject) {
      setError('Please select a project');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      let finalImageUrl = ''; // No longer manually uploading source images

      // Upload image if file exists
      // (Removed manual source image upload logic)

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: finalImageUrl,
          audio_url: selectedMusic[0].url, // Legacy shim?
          music_ids: selectedMusic.map(m => m.id),
          title_text: title.trim(),
          animation_id: selectedAnimation || undefined,
          project_id: currentProject.id,
          // We can construct a simple assets timeline from this if we want to unify backend
          // But for now, let's keep it simple as requested
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create video');
      }

      const job = await response.json();
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const addAssetToPlaylist = async (anim: Animation) => {
    if (!currentProject) return;

    const supabase = createClient();
    const currentAssets = (currentProject as any).template_assets || [];
    const newAsset = {
      id: crypto.randomUUID(),
      type: 'animation',
      url: anim.url,
      duration: 10
    };

    const { data } = await supabase
      .from("projects")
      .update({ template_assets: [...currentAssets, newAsset] })
      .eq("id", currentProject.id)
      .select()
      .single();

    if (data) refreshProjects();
  };

  const addMusic = (track: MusicTrack) => {
    const exists = selectedMusic.find(m => m.id === track.id);
    if (exists) {
      // Toggle off - remove from selection
      setSelectedMusic(selectedMusic.filter(m => m.id !== track.id));
    } else {
      // Add to selection
      setSelectedMusic([...selectedMusic, track]);
    }
  };

  const removeMusic = (id: string) => {
    setSelectedMusic(selectedMusic.filter(m => m.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedMusicIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedMusicIndex === null || draggedMusicIndex === index) return;

    const newMusic = [...selectedMusic];
    const draggedItem = newMusic[draggedMusicIndex];
    newMusic.splice(draggedMusicIndex, 1);
    newMusic.splice(index, 0, draggedItem);
    setSelectedMusic(newMusic);
    setDraggedMusicIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedMusicIndex(null);
  };

  const getTotalDuration = () => {
    return selectedMusic.reduce((total, track) => total + (track.duration_seconds || 0), 0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSelectedAnimationName = () => {
    return animations.find(a => a.id === selectedAnimation)?.images?.filename || 'Select Animation';
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              {currentProject
                ? <>{currentProject.name}</>
                : <span className="gradient-text">Select a Project</span>}
            </h1>
          </div>

          {/* Project Selection or Create Form */}
          {!currentProject ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Create New Project Card */}
                <button
                  onClick={async () => {
                    const name = prompt('Enter project name:');
                    if (name) await createProject(name);
                  }}
                  className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group h-full min-h-[200px]"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">New Project</h3>
                  <p className="text-sm text-muted">Start a new video project</p>
                </button>

                {/* Existing Projects */}
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project)}
                    className="flex flex-col text-left p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group h-full min-h-[200px]"
                  >
                    <div className="flex items-start justify-between w-full mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-primary/10 text-primary">
                          <FolderOpen className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs text-muted font-mono block">
                            {new Date(project.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsProject(project);
                        }}
                        className="p-2 rounded-lg hover:bg-muted text-muted hover:text-foreground transition-colors"
                        title="Project Settings"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted mt-auto">
                      Click to select
                      <span className="inline-block transition-transform group-hover:translate-x-1 ml-1">→</span>
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {/* Animation Selection (Conditional) */}
                  <div className="p-6 rounded-2xl bg-card border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Video className="w-5 h-5 text-primary" />
                        {(currentProject as any)?.video_mode === 'image_slideshow'
                          ? 'Image Slideshow'
                          : (currentProject as any)?.video_mode === 'multi_animation'
                            ? 'Animation Sequence'
                            : 'Animation Style'}
                      </h2>
                    </div>

                    {/* Simple Mode: Picker */}
                    {(!(currentProject as any)?.video_mode || (currentProject as any)?.video_mode === 'simple_animation') && (
                      <button
                        type="button"
                        onClick={() => setShowAnimationPicker(true)}
                        className="w-full p-4 rounded-xl bg-background border border-border hover:border-primary transition-all text-left flex items-center justify-between"
                      >
                        <span className={selectedAnimation ? "text-foreground" : "text-muted"}>
                          {getSelectedAnimationName()}
                        </span>
                        <span className="text-primary text-sm">Change</span>
                      </button>
                    )}

                    {/* Multi/Slideshow Mode: Playlist Editor */}
                    {(currentProject as any)?.video_mode && (currentProject as any)?.video_mode !== 'simple_animation' && (
                      <div className="mt-4">
                        <AssetPlaylistEditor
                          project={currentProject}
                          onUpdate={(updated) => {
                            // We need to update the local project state
                            refreshProjects();
                          }}
                          onAddAnimation={() => setShowAnimationPicker(true)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Music Selection */}
                <div className="p-6 rounded-2xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Music className="w-5 h-5 text-primary" />
                      Music Selection
                    </h2>
                    <span className="text-sm text-muted">
                      Total Duration: {formatDuration(getTotalDuration())}
                    </span>
                  </div>

                  {selectedMusic.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {selectedMusic.map((track, index) => (
                        <div
                          key={track.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-3 rounded-xl bg-background border border-border cursor-move ${draggedMusicIndex === index ? 'opacity-50' : ''}`}
                        >
                          <GripVertical className="w-4 h-4 text-muted" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{track.filename}</p>
                          </div>
                          <button type="button" onClick={() => removeMusic(track.id)} className="text-muted hover:text-error">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMusicPicker(true)}
                      className="flex-1 p-3 rounded-xl border-2 border-dashed border-border hover:border-primary text-muted hover:text-primary transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Music
                    </button>
                    <a href="/music-library" className="px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground transition-colors">
                      Manage Library
                    </a>
                  </div>
                </div>

                {/* Title Input */}
                <div className="p-6 rounded-2xl bg-card border border-border">
                  <label className="flex items-center gap-2 text-lg font-medium text-foreground mb-4">
                    <Type className="w-5 h-5 text-primary" />
                    Video Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter your video title..."
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted"
                    maxLength={100}
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || selectedMusic.length === 0 || !title.trim()}
                  className="btn-primary w-full py-4 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Create Video
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* Animation Picker Modal */}
      {showAnimationPicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Select Animation</h2>
              <button onClick={() => setShowAnimationPicker(false)} className="p-2 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {animations.map((anim) => (
                  <button
                    key={anim.id}
                    onClick={() => {
                      const mode = (currentProject as any)?.video_mode;
                      if (!mode || mode === 'simple_animation') {
                        setSelectedAnimation(anim.id);
                        setShowAnimationPicker(false);
                      } else {
                        addAssetToPlaylist(anim);
                        // Don't close modal in multi-mode so user can pick more
                        // setShowAnimationPicker(false);
                      }
                    }}
                    className={`rounded-xl overflow-hidden border-2 transition-all relative ${selectedAnimation === anim.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary'}`}
                  >
                    <div className="aspect-video bg-black relative">
                      <video src={anim.url!} className="w-full h-full object-cover" muted loop onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()} />
                    </div>
                    <div className="p-2 bg-card text-left">
                      <p className="text-sm font-medium">{anim.images?.filename || 'Animation'}</p>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                      <Video className="w-3 h-3" />
                      {anim.video_usage_count || 0}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Music Picker Modal (Multi-Select) */}
      {showMusicPicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Add Music {selectedMusic.length > 0 && <span className="text-primary">({selectedMusic.length} selected)</span>}
              </h2>
              <button onClick={() => setShowMusicPicker(false)} className="p-2 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {musicLibrary.map((track) => {
                  const isSelected = !!selectedMusic.find(m => m.id === track.id);
                  return (
                    <button
                      key={track.id}
                      onClick={() => addMusic(track)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary'
                        }`}
                    >
                      <Music className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{track.filename}</p>
                          <span className="text-xs text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {track.video_usage_count || 0}
                          </span>
                        </div>
                        <p className="text-xs text-muted">{formatDuration(track.duration_seconds || 0)}</p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={() => setShowMusicPicker(false)}
                className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsProject && (
        <ProjectConfigModal
          project={settingsProject}
          isOpen={!!settingsProject}
          onClose={() => setSettingsProject(null)}
          onUpdate={(updated) => {
            refreshProjects();
          }}
        />
      )}
    </div>
  );
}
