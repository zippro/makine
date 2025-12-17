'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Wand2, Video, Music, Type, Loader2, GripVertical, X, Plus, AlertCircle, FolderOpen } from 'lucide-react';

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

// ... imports
// ... imports
// ... imports
import { TimelineEditor } from '@/components/TimelineEditor';
import { OverlayEditor } from '@/components/OverlayEditor';
import { TimelineItem, OverlayItem } from '@/lib/types';
import { useProject } from '@/context/ProjectContext';

export default function Home() {
  const router = useRouter();
  const { currentProject, projects, selectProject, createProject } = useProject();
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [musicLibrary, setMusicLibrary] = useState<MusicTrack[]>([]);

  // New State for Advanced Editor
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);

  const [selectedMusic, setSelectedMusic] = useState<MusicTrack[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [draggedMusicIndex, setDraggedMusicIndex] = useState<number | null>(null);

  // ... useEffect (Fetch Data) ...

  const addAnimationToTimeline = (anim: Animation) => {
    setTimeline([...timeline, {
      type: 'animation',
      id: anim.id,
      duration: anim.duration || 10,
      loop: false
    }]);
    setShowAnimationPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (timeline.length === 0) {
      setError('Please add at least one item to the timeline');
      return;
    }
    if (selectedMusic.length === 0) {
      setError('Please select at least one music track');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a video title');
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
          // music_ids and title remain
          music_ids: selectedMusic.map(m => m.id),
          title_text: title.trim(),
          project_id: currentProject.id,
          // New Assets Structure
          assets: {
            timeline,
            overlays
          },
          // Legacy support (optional, maybe pick first animation)
          animation_id: timeline.find(t => t.type === 'animation')?.id
        }),
      });
      project_id: currentProject.id, // Include project_id
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

const addMusic = (track: MusicTrack) => {
  if (!selectedMusic.find(m => m.id === track.id)) {
    setSelectedMusic([...selectedMusic, track]);
  }
  setShowMusicPicker(false);
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Makine Video AI
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Create <span className="gradient-text">Music Videos</span>
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">
            {currentProject
              ? `Project: ${currentProject.name}`
              : 'Select a project to start creating'}
          </p>
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
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <span className="text-xs text-muted font-mono">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
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
          /* Create Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Advanced Editor */}
            <div className="space-y-6">
              {/* Timeline Section */}
              <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    Video Timeline
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAnimationPicker(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add to Timeline
                  </button>
                </div>

                <TimelineEditor
                  items={timeline}
                  onUpdate={setTimeline}
                />
              </div>

              {/* Overlays Section */}
              <div className="p-6 rounded-2xl bg-card border border-border">
                <OverlayEditor
                  items={overlays}
                  onUpdate={setOverlays}
                />
              </div>
            </div>

            <div className="space-y-6">
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
                {/* ... (Existing Music List Code is below this, so we stop here) */}* Music Selector */}
                <div className="p-6 rounded-2xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2 text-lg font-medium text-foreground">
                      <Music className="w-5 h-5 text-primary" />
                      Music Tracks
                      {selectedMusic.length > 0 && (
                        <span className="text-sm text-muted">
                          ({formatDuration(getTotalDuration())} total)
                        </span>
                      )}
                    </label>
                    <a href="/music-library" className="text-sm text-primary hover:underline">
                      Manage →
                    </a>
                  </div>

                  {/* Selected Music List */}
                  {selectedMusic.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {selectedMusic.map((track, index) => (
                        <div
                          key={track.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-3 rounded-xl bg-background border border-border cursor-move ${draggedMusicIndex === index ? 'opacity-50' : ''
                            }`}
                        >
                          <GripVertical className="w-4 h-4 text-muted" />
                          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{track.filename}</p>
                            <p className="text-xs text-muted">
                              {formatDuration(track.duration_seconds || 0)} •
                              Used in {track.video_usage_count} video{track.video_usage_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMusic(track.id)}
                            className="p-1.5 text-muted hover:text-error transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowMusicPicker(true)}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary transition-all flex items-center justify-center gap-2 text-muted hover:text-primary"
                  >
                    <Plus className="w-5 h-5" />
                    Add Music Track
                  </button>
                </div>

                {/* Title Input */}
                <div className="p-6 rounded-2xl bg-card border border-border">
                  <label className="flex items-center gap-2 text-lg font-medium text-foreground mb-4">
                    <Type className="w-5 h-5 text-primary" />
                    Video Title
                    <span className="text-sm text-muted font-normal">(appears at 7s)</span>
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
                  <p className="text-xs text-muted text-right mt-1">{title.length}/100</p>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !selectedAnimation || selectedMusic.length === 0 || !title.trim()}
                  className="btn-primary w-full py-4 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Video...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Create Video
                    </>
                  )}
                </button>
              </form>
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
                {animations.length === 0 ? (
                  <div className="text-center py-8">
                    <Video className="w-12 h-12 text-muted mx-auto mb-2" />
                    <p className="text-muted">No approved animations yet</p>
                    <a href="/upload-images" className="text-primary hover:underline mt-2 inline-block">
                      Upload images to create animations →
                    </a>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {animations.map((anim) => (
                      <button
                        key={anim.id}
                        onClick={() => addAnimationToTimeline(anim)}
                        className="rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-all group relative"
                      >
                        <div className="absolute inset-0 z-10 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Plus className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                        <div className="aspect-video bg-black relative">
                          <video
                            src={anim.url!}
                            poster={anim.images?.url}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            preload={anim.images?.url ? "none" : "metadata"}
                            onMouseEnter={(e) => {
                              const p = e.currentTarget.play();
                              if (p !== undefined) p.catch(() => { });
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                        </div>
                        <div className="p-2 bg-card">
                          <p className="text-sm text-foreground">{anim.duration}s</p>
                          <p className="text-xs text-muted">
                            {anim.video_usage_count} video{anim.video_usage_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Music Picker Modal */}
        {showMusicPicker && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Add Music</h2>
                <button onClick={() => setShowMusicPicker(false)} className="p-2 text-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {musicLibrary.length === 0 ? (
                  <div className="text-center py-8">
                    <Music className="w-12 h-12 text-muted mx-auto mb-2" />
                    <p className="text-muted">No music in library</p>
                    <a href="/music-library" className="text-primary hover:underline mt-2 inline-block">
                      Upload music →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {musicLibrary.map((track) => {
                      const isSelected = selectedMusic.find(m => m.id === track.id);
                      return (
                        <button
                          key={track.id}
                          onClick={() => !isSelected && addMusic(track)}
                          disabled={!!isSelected}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected
                            ? 'border-primary/50 bg-primary/10 opacity-50 cursor-not-allowed'
                            : 'border-border hover:border-primary bg-background'
                            }`}
                        >
                          <Music className="w-5 h-5 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{track.filename}</p>
                            <p className="text-xs text-muted">
                              {formatDuration(track.duration_seconds || 0)} •
                              {track.video_usage_count} video{track.video_usage_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          {isSelected && <span className="text-xs text-primary">Added</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      );
}
