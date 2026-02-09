'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Wand2, Upload, Music, Type, Loader2, GripVertical, X, Plus, AlertCircle, FolderOpen, Video, Settings, Check, Image as ImageIcon } from 'lucide-react';
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
  folder?: string;
  created_at?: string;
}

interface ProjectImage {
  id: string;
  url: string;
  filename: string;
  folder?: string;
  created_at?: string;
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

  // Form State
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack[]>([]);
  const [title, setTitle] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [projectImages, setProjectImages] = useState<ProjectImage[]>([]);
  const [draggedMusicIndex, setDraggedMusicIndex] = useState<number | null>(null);
  const [projectFolders, setProjectFolders] = useState<{ id: string; path: string; project_id: string }[]>([]);

  // Folder State
  const [currentMusicFolder, setCurrentMusicFolder] = useState<string>('/');
  const [currentAnimFolder, setCurrentAnimFolder] = useState<string>('/');
  const [currentImageFolder, setCurrentImageFolder] = useState<string>('/');

  const getFolderContents = (items: any[], folder: string) => {
    return items.filter(i => (i.folder || '/') === folder);
  };

  const getSubfolders = (items: any[], currentPath: string) => {
    const folders = new Set<string>();

    // 1. From persistent DB folders
    projectFolders.forEach(pf => {
      const fPath = pf.path;
      if (fPath !== currentPath && fPath.startsWith(currentPath)) {
        const rel = fPath.slice(currentPath.length + (currentPath === '/' ? 0 : 1));
        const firstPart = rel.split('/')[0];
        if (firstPart) folders.add(currentPath === '/' ? `/${firstPart}` : `${currentPath}/${firstPart}`);
      }
    });

    // 2. From item data
    items.forEach(i => {
      const f = i.folder || '/';
      if (f !== currentPath && f.startsWith(currentPath)) {
        const rel = f.slice(currentPath.length + (currentPath === '/' ? 0 : 1));
        const firstPart = rel.split('/')[0];
        if (firstPart) folders.add(currentPath === '/' ? `/${firstPart}` : `${currentPath}/${firstPart}`);
      }
    });
    return Array.from(folders).sort();
  };

  const createFolder = async (type: 'music' | 'animation', folderName: string) => {
    if (!currentProject) return;
    const current = type === 'music' ? currentMusicFolder : currentAnimFolder;
    const newPath = current === '/' ? `/${folderName}` : `${current}/${folderName}`;
    if (type === 'music') setCurrentMusicFolder(newPath);
    else setCurrentAnimFolder(newPath);
  };

  const handleFileUploadToFolder = async (e: React.ChangeEvent<HTMLInputElement>, type: 'music' | 'animation') => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    const folder = type === 'music' ? currentMusicFolder : currentAnimFolder;

    setIsLoading(true);
    try {
      const supabase = createClient();
      const bucket = type === 'music' ? 'audio' : 'animations';
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);

      // Save to DB with Folder
      const table = type === 'music' ? 'music_library' : 'animations';
      const payload: any = {
        project_id: currentProject?.id,
        url: publicUrl,
        filename: file.name,
        folder: folder,
      };

      if (type === 'music') {
        payload.duration_seconds = 0;
        payload.video_usage_count = 0;
      } else {
        payload.duration = 10;
        payload.is_approved = true;
        payload.video_usage_count = 0;
      }

      const { error: dbError } = await supabase.from(table).insert(payload);
      if (dbError) throw dbError;

      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Data
  useEffect(() => {
    if (!currentProject) return;

    const fetchData = async () => {
      const supabase = createClient();

      const { data: anims } = await supabase
        .from('animations')
        .select('*, images(*)')
        .eq('is_approved', true)
        .or(`project_id.eq.${currentProject.id},project_id.is.null`)
        .order('video_usage_count', { ascending: false });

      const { data: music } = await supabase
        .from('music_library')
        .select('*')
        .or(`project_id.eq.${currentProject.id},project_id.is.null`)
        .order('video_usage_count', { ascending: false });

      if (anims) setAnimations(anims);
      if (music) setMusicLibrary(music);

      // Fetch persistent folders
      try {
        const foldersRes = await fetch(`/api/folders?projectId=${currentProject.id}`);
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json();
          setProjectFolders(foldersData);
        }
      } catch (err) {
        console.error('Failed to fetch folders', err);
      }
    };

    fetchData();
  }, [currentProject]);

  // Fetch images when image picker opens
  useEffect(() => {
    if (!showImagePicker || !currentProject) return;
    const fetchImages = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('images')
        .select('id, url, filename, folder, created_at')
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false });
      if (data) setProjectImages(data);
    };
    fetchImages();
  }, [showImagePicker, currentProject]);

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

    if (selectedMusic.length === 0) {
      setError('Please select at least one music track');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a video title');
      return;
    }

    // Unified Mode Check: Must have assets in playlist
    if (!((currentProject as any)?.template_assets) || (currentProject as any).template_assets.length === 0) {
      setError('Playlist is empty. Please add images or animations.');
      return;
    }

    if (!currentProject) {
      setError('Please select a project');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: '',
          audio_url: selectedMusic[0].url,
          music_ids: selectedMusic.map(m => m.id),
          title_text: title.trim(),
          project_id: currentProject.id,
          // Worker will pick up template_assets from project
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

  const toggleAssetInPlaylist = async (anim: Animation) => {
    if (!currentProject) return;

    const supabase = createClient();
    const currentAssets = (currentProject as any).template_assets || [];

    const newAsset = {
      id: crypto.randomUUID(),
      type: 'animation',
      url: anim.url,
      duration: 10,
      loop_count: (currentProject as any).default_loop_count || 1
    };

    const newAssets = [...currentAssets, newAsset];

    const { data } = await supabase
      .from("projects")
      .update({ template_assets: newAssets })
      .eq("id", currentProject.id)
      .select()
      .single();

    if (data) refreshProjects();
  };

  const addImageToPlaylist = async (img: ProjectImage) => {
    if (!currentProject) return;

    const supabase = createClient();
    const currentAssets = (currentProject as any).template_assets || [];

    const newAsset = {
      id: crypto.randomUUID(),
      type: 'image',
      url: img.url,
      duration: (currentProject as any).default_image_duration || 15
    };

    const newAssets = [...currentAssets, newAsset];

    const { data } = await supabase
      .from("projects")
      .update({ template_assets: newAssets })
      .eq("id", currentProject.id)
      .select()
      .single();

    if (data) refreshProjects();
  };

  const addMusic = (track: MusicTrack) => {
    const exists = selectedMusic.find(m => m.id === track.id);
    if (exists) {
      setSelectedMusic(selectedMusic.filter(m => m.id !== track.id));
    } else {
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

          {!currentProject ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  {/* Playlist Editor (Always Visible for Unified Mode) */}
                  <div className="p-6 rounded-2xl bg-card border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Video className="w-5 h-5 text-primary" />
                        Visual Assets
                      </h2>
                    </div>

                    <div className="mt-4">
                      <AssetPlaylistEditor
                        project={currentProject}
                        onUpdate={(updated) => {
                          refreshProjects();
                        }}
                        onAddAnimation={() => setShowAnimationPicker(true)}
                        onAddImage={() => { setCurrentImageFolder('/'); setShowImagePicker(true); }}
                      />
                    </div>
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
                  className="btn-primary w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
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
          <div className="bg-card rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <h2 className="text-lg font-semibold text-foreground whitespace-nowrap">Select Animation</h2>
                <div className="flex items-center gap-1 text-muted-foreground text-sm overflow-hidden text-ellipsis">
                  <span className="mx-1">/</span>
                  {currentAnimFolder !== '/' && (
                    <button onClick={() => setCurrentAnimFolder(currentAnimFolder.split('/').slice(0, -1).join('/') || '/')} className="hover:text-foreground hover:underline">
                      ...
                    </button>
                  )}
                  <span className="font-mono">{currentAnimFolder}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentAnimFolder !== '/' && (
                  <button onClick={() => setCurrentAnimFolder(currentAnimFolder.split('/').slice(0, -1).join('/') || '/')} className="p-2 bg-muted/50 rounded-lg hover:bg-muted">
                    Up
                  </button>
                )}
                <button onClick={() => {
                  const name = prompt('Folder Name:');
                  if (name) createFolder('animation', name);
                }} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
                  <Plus className="w-5 h-5" />
                </button>
                <label className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => handleFileUploadToFolder(e, 'animation')} />
                </label>
                <button onClick={() => setShowAnimationPicker(false)} className="p-2 text-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* Folders */}
                {(() => {
                  const subfolders = getSubfolders(animations, currentAnimFolder);
                  return subfolders.sort().map(folderPath => {
                    const folderName = folderPath.split('/').pop();
                    const count = animations.filter(a => {
                      const f = a.folder || '/';
                      return f === folderPath || f.startsWith(folderPath + '/');
                    }).length;
                    return (
                      <button key={folderPath} onDoubleClick={() => setCurrentAnimFolder(folderPath)} className="group rounded-xl border-2 border-border border-dashed p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <FolderOpen className="w-10 h-10 text-primary/50 group-hover:text-primary" />
                        <span className="text-sm font-medium">{folderName}</span>
                        <span className="text-xs text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</span>
                      </button>
                    )
                  });
                })()}

                {/* Files */}
                {getFolderContents(animations, currentAnimFolder).map((anim) => {
                  return (
                    <button
                      key={anim.id}
                      onClick={() => toggleAssetInPlaylist(anim)}
                      className={`group rounded-xl overflow-hidden border-2 transition-all relative border-border hover:border-primary`}
                    >
                      <div className="aspect-video bg-black relative">
                        <video
                          src={anim.url!}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                          poster={anim.images?.url}
                          onMouseEnter={e => e.currentTarget.play()}
                          onMouseLeave={e => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                      </div>
                      <div className="p-2 bg-card text-left">
                        <p className="text-sm font-medium truncate">{anim.images?.filename || 'Animation'}</p>
                      </div>

                      <div className="absolute top-2 right-2 flex gap-1">
                        <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                          {Math.round(anim.duration || 0)}s
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <h2 className="text-lg font-semibold text-foreground whitespace-nowrap">Select Image</h2>
                <div className="flex items-center gap-1 text-muted-foreground text-sm overflow-hidden text-ellipsis">
                  <span className="mx-1">/</span>
                  {currentImageFolder !== '/' && (
                    <button onClick={() => setCurrentImageFolder(currentImageFolder.split('/').slice(0, -1).join('/') || '/')} className="hover:text-foreground hover:underline">
                      ...
                    </button>
                  )}
                  <span className="font-mono">{currentImageFolder}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentImageFolder !== '/' && (
                  <button onClick={() => setCurrentImageFolder(currentImageFolder.split('/').slice(0, -1).join('/') || '/')} className="p-2 bg-muted/50 rounded-lg hover:bg-muted">
                    Up
                  </button>
                )}
                <label className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    if (!e.target.files || !e.target.files.length || !currentProject) return;
                    const file = e.target.files[0];
                    setIsLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('project_id', currentProject.id);
                      const res = await fetch('/api/upload', { method: 'POST', body: formData });
                      if (!res.ok) throw new Error('Upload failed');
                      const { url: publicUrl } = await res.json();
                      // Save to images table
                      const supabase = createClient();
                      await supabase.from('images').insert({
                        url: publicUrl,
                        filename: file.name,
                        project_id: currentProject.id,
                        folder: currentImageFolder,
                      });
                      // Refresh images
                      const { data } = await supabase
                        .from('images')
                        .select('id, url, filename, folder, created_at')
                        .eq('project_id', currentProject.id)
                        .order('created_at', { ascending: false });
                      if (data) setProjectImages(data);
                    } catch (err: any) {
                      alert('Upload failed: ' + err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }} />
                </label>
                <button onClick={() => setShowImagePicker(false)} className="p-2 text-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* Folders */}
                {(() => {
                  const subfolders = getSubfolders(projectImages, currentImageFolder);
                  return subfolders.sort().map(folderPath => {
                    const folderName = folderPath.split('/').pop();
                    return (
                      <button key={folderPath} onDoubleClick={() => setCurrentImageFolder(folderPath)} className="group rounded-xl border-2 border-border border-dashed p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <FolderOpen className="w-10 h-10 text-primary/50 group-hover:text-primary" />
                        <span className="text-sm font-medium">{folderName}</span>
                      </button>
                    )
                  });
                })()}

                {/* Images */}
                {getFolderContents(projectImages, currentImageFolder).map((img) => (
                  <button
                    key={img.id}
                    onClick={() => addImageToPlaylist(img)}
                    className="group rounded-xl overflow-hidden border-2 transition-all relative border-border hover:border-primary"
                  >
                    <div className="aspect-video bg-black relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-2 bg-card text-left">
                      <p className="text-sm font-medium truncate">{img.filename}</p>
                    </div>
                  </button>
                ))}

                {getFolderContents(projectImages, currentImageFolder).length === 0 && getSubfolders(projectImages, currentImageFolder).length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No images in this folder.</p>
                    <p className="text-xs text-muted mt-1">Upload images or go to the Images page to add some.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Music Picker Modal */}
      {showMusicPicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <h2 className="text-lg font-semibold text-foreground whitespace-nowrap">
                  Add Music {selectedMusic.length > 0 && <span className="text-primary">({selectedMusic.length} selected)</span>}
                </h2>
                <div className="flex items-center gap-1 text-muted-foreground text-sm overflow-hidden text-ellipsis">
                  <span className="mx-1">/</span>
                  {currentMusicFolder !== '/' && (
                    <button onClick={() => setCurrentMusicFolder(currentMusicFolder.split('/').slice(0, -1).join('/') || '/')} className="hover:text-foreground hover:underline">
                      ...
                    </button>
                  )}
                  <span className="font-mono">{currentMusicFolder}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentMusicFolder !== '/' && (
                  <button onClick={() => setCurrentMusicFolder(currentMusicFolder.split('/').slice(0, -1).join('/') || '/')} className="p-2 bg-muted/50 rounded-lg hover:bg-muted">
                    Up
                  </button>
                )}
                <button onClick={() => {
                  const name = prompt('Folder Name:');
                  if (name) createFolder('music', name);
                }} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
                  <Plus className="w-5 h-5" />
                </button>
                <label className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <input type="file" accept="audio/mpeg,audio/wav,audio/ogg" className="hidden" onChange={(e) => handleFileUploadToFolder(e, 'music')} />
                </label>
                <button onClick={() => setShowMusicPicker(false)} className="p-2 text-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {getSubfolders(musicLibrary, currentMusicFolder).map(folderPath => {
                  const folderName = folderPath.split('/').pop();
                  const count = musicLibrary.filter(t => {
                    const f = (t as any).folder || '/';
                    return f === folderPath || f.startsWith(folderPath + '/');
                  }).length;
                  return (
                    <button key={folderPath} onDoubleClick={() => setCurrentMusicFolder(folderPath)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50 hover:border-primary/50 text-left transition-all">
                      <FolderOpen className="w-5 h-5 text-primary/50" />
                      <span className="font-medium flex-1">{folderName}</span>
                      <span className="text-xs text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</span>
                    </button>
                  )
                })}

                {getFolderContents(musicLibrary, currentMusicFolder).map((track) => {
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
                className="w-full bg-primary text-black py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
