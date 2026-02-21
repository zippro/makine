-- Add youtube_draft column to store saved metadata (title, description, tags, schedule)
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS youtube_draft JSONB DEFAULT NULL;
