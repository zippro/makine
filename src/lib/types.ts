// TypeScript types for the application

export type JobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface VideoJob {
  id: string;
  user_id: string;
  image_url: string;
  audio_url: string;
  title_text: string;
  status: JobStatus;
  error_message: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
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
