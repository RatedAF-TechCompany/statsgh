-- Create comments table
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_published BOOLEAN NOT NULL DEFAULT false,
  verification_code TEXT NOT NULL,
  verification_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 1000),
  CONSTRAINT email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for performance
CREATE INDEX idx_comments_article_id ON public.comments(article_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at);
CREATE INDEX idx_comments_email ON public.comments(email);
CREATE INDEX idx_comments_is_published ON public.comments(is_published);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read published comments
CREATE POLICY "Anyone can view published comments"
ON public.comments
FOR SELECT
USING (is_published = true);

-- Policy: System can insert comments (via edge function)
CREATE POLICY "System can insert comments"
ON public.comments
FOR INSERT
WITH CHECK (true);

-- Policy: System can update comments for verification
CREATE POLICY "System can update comments"
ON public.comments
FOR UPDATE
USING (true);

-- Add trigger for updated_at if needed
CREATE OR REPLACE FUNCTION public.update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = OLD.created_at; -- Prevent created_at from being updated
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_created_at_update
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_comments_updated_at();