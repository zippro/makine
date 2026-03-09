-- Add fal_request_id column to animations table for async status tracking
ALTER TABLE animations ADD COLUMN IF NOT EXISTS fal_request_id TEXT;
