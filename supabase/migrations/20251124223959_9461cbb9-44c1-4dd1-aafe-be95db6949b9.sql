-- Add parent_id column to comments table for threaded replies
ALTER TABLE comments ADD COLUMN parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;

-- Add index for better query performance on replies
CREATE INDEX idx_comments_parent_id ON comments(parent_id);