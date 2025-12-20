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
  template_assets?: any[]; // Using any[] for flexibility, or stronger type if preferred
  overlay_config?: {
    images: any[];
    title: {
      enabled: boolean;
      start_time: number;
      duration: number;
      position: string;
      font: string;
      fontSize?: number;
    };
  };
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
