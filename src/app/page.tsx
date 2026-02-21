'use client';

import Link from 'next/link';
import { useProject } from '@/context/ProjectContext';
import {
  Image, Music, Video, Sparkles, Upload, History, ArrowRight,
  Clapperboard, CheckCircle2, FolderOpen
} from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Upload Images',
    description: 'Upload your images or generate new ones with AI',
    icon: Image,
    href: '/upload-images',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    items: ['Upload from device', 'AI-generate with Flux 2 Turbo', 'Organize in folders'],
  },
  {
    step: 2,
    title: 'Add Music',
    description: 'Upload music tracks or browse your library',
    icon: Music,
    href: '/music-library',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-500/10',
    items: ['Upload MP3 / WAV files', 'Manage music library', 'Set track order'],
  },
  {
    step: 3,
    title: 'Create Animations',
    description: 'Generate AI-powered animations from your images',
    icon: Video,
    href: '/animations',
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-500/10',
    items: ['AI-powered image-to-video', 'Kling video generation', 'Review & approve clips'],
  },
  {
    step: 4,
    title: 'Build Your Video',
    description: 'Combine animations and music into a final video',
    icon: Clapperboard,
    href: '/create-video',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    items: ['Drag & drop timeline', 'Add transitions', 'Preview & render'],
  },
  {
    step: 5,
    title: 'Publish',
    description: 'Upload to YouTube or download your video',
    icon: Upload,
    href: '/publish',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
    items: ['Direct YouTube upload', 'Download MP4', 'Share links'],
  },
];

export default function HomePage() {
  const { currentProject } = useProject();

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-400">
          <Sparkles className="w-4 h-4" />
          AI-Powered Video Creation
        </div>
        <h1 className="text-4xl md:text-5xl font-bold">
          <span className="gradient-text">Create Music Videos</span>
          <br />
          <span className="text-foreground/80">in 5 Simple Steps</span>
        </h1>
        <p className="text-muted max-w-2xl mx-auto text-lg">
          Transform your images into stunning AI-animated music videos.
          Upload, generate, compose, and publish — all in one place.
        </p>
      </div>

      {/* Current Project */}
      {currentProject && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <FolderOpen className="w-4 h-4" />
          Working on: <span className="text-primary font-medium">{currentProject.name}</span>
        </div>
      )}

      {/* Workflow Steps */}
      <div className="space-y-4">
        {WORKFLOW_STEPS.map((step, index) => (
          <Link
            key={step.step}
            href={step.href}
            className="group block bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <div className="flex items-start gap-5">
              {/* Step Number + Icon */}
              <div className="flex-shrink-0 relative">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center text-xs font-bold text-muted">
                  {step.step}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>
                  <ArrowRight className="w-5 h-5 text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-sm text-muted mt-1">{step.description}</p>
                <div className="flex flex-wrap gap-3 mt-3">
                  {step.items.map((item) => (
                    <span
                      key={item}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${step.bgColor} text-foreground/70`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Connector */}
            {index < WORKFLOW_STEPS.length - 1 && (
              <div className="ml-7 mt-4 h-4 border-l-2 border-dashed border-border" />
            )}
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-8">
        <Link
          href="/creator/image"
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-purple-500/30 transition-colors"
        >
          <Sparkles className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-sm font-medium">AI Image Creator</p>
            <p className="text-xs text-muted">Generate with Flux 2</p>
          </div>
        </Link>
        <Link
          href="/history"
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-blue-500/30 transition-colors"
        >
          <History className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-sm font-medium">Video History</p>
            <p className="text-xs text-muted">View past renders</p>
          </div>
        </Link>
        <Link
          href="/todos"
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-green-500/30 transition-colors"
        >
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium">Todo List</p>
            <p className="text-xs text-muted">Track your tasks</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
