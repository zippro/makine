
-- Migration: Add default_loop_count and default_image_duration to projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS default_loop_count INTEGER DEFAULT 1;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS default_image_duration NUMERIC DEFAULT 15.0;

-- Optional: We don't delete video_mode yet to avoid breaking existing code immediately, 
-- but we will stop using it in the frontend.
