// TypeScript types for the application

export type JobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface TimelineItem {
  type: 'animation' | 'image';
  id?: string; // for animations
  url?: string; // for images
  duration: number;
  loop?: boolean; // for animations
}

export interface OverlayItem {
  type: 'image' | 'text';
  url?: string;
  content?: string;
  start: number;
  duration: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  font?: string;
}

export interface Project {
  id: string;
  name: string;
  user_id: string; // Owner
  created_at: string;
  youtube_creds?: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
    channel_id?: string;
  };
  video_mode?: 'simple_animation' | 'multi_animation' | 'image_slideshow';
  template_assets?: {
    id: string;
    type: 'animation' | 'image';
    url: string;
    duration: number;
    loop_count?: number; // New: Repeat count for animations
  }[];
  overlay_config?: {
    images: any[];
    title: {
      enabled: boolean;
      start_time: number;
      duration: number;
      position: string;
      font: string;
      fontSize?: number;
      fade_duration?: number; // New: Fade effect
    };
  };
  visualizer_config?: { // New: Audio Visualizer
    enabled: boolean;
    style: 'bar' | 'line';
    color: string;
    position: 'bottom' | 'top';
  };
  default_loop_count?: number; // New: Global loop count for animations
  default_image_duration?: number; // New: Global duration for images
  channel_info?: string; // New: AI Context
  keywords?: string; // New: AI Context
  animation_prompts?: {
    id: string;
    name: string;
    prompt: string;
  }[];
}

export interface VideoJob {
  id: string;
  project_id: string;
  status: JobStatus;
  title_text: string;
  animation_id?: string; // Legacy
  music_ids: string[];
  assets?: {
    timeline: TimelineItem[];
    overlays: OverlayItem[];
  };
  video_url: string | null;
  image_url: string | null;
  audio_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  progress?: number; // 0-100
}

export interface CreateJobInput {
  image_url: string;
  audio_url: string;
  title_text: string;
}

export interface UploadResult {
  url: string;
  path: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// n8n webhook payload
export interface N8nWebhookPayload {
  job_id: string;
  status: JobStatus;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  error_message?: string;
}

// Todo System Types
export type Priority = 'low' | 'medium' | 'high';

export interface TodoList {
  id: string;
  project_id: string;
  folder_id?: string;
  name: string;
  created_at: string;
  updated_at: string;
  // Computed fields (from joins)
  items_count?: number;
  completed_count?: number;
}

export interface TodoItem {
  id: string;
  todo_list_id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  due_date?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DefaultTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  priority: Priority;
  order_index: number;
}

// Dev Plan types
export type DevPlanStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface DevPlanVersion {
  id: string;
  name: string;
  description?: string;
  status: DevPlanStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
  // Computed fields
  tasks_count?: number;
  completed_count?: number;
}

export interface DevPlanTask {
  id: string;
  version_id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Channel Plan types
export interface ChannelPlanContainer {
  id: string;
  name: string;
  description?: string;
  status: DevPlanStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
  // Computed fields
  items_count?: number;
  completed_count?: number;
}

export interface ChannelPlanItem {
  id: string;
  container_id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  order_index: number;
  created_at: string;
  updated_at: string;
}
