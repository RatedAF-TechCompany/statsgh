-- Add columns to profiles table for user management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL,
  invited_by UUID REFERENCES public.profiles(id),
  invite_token TEXT NOT NULL UNIQUE,
  note TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit_events table
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES public.profiles(id),
  user_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_invitations
CREATE POLICY "Admins can manage invitations"
ON public.user_invitations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for audit_events
CREATE POLICY "Admins can view all audit events"
ON public.audit_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view their own audit events"
ON public.audit_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit events"
ON public.audit_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update articles RLS policies for role-based access
DROP POLICY IF EXISTS "Admins can update articles" ON public.articles;
DROP POLICY IF EXISTS "Admins can delete articles" ON public.articles;
DROP POLICY IF EXISTS "Admins can insert articles" ON public.articles;

CREATE POLICY "Admins and Editors can insert articles"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR
  has_role(auth.uid(), 'contributor'::app_role)
);

CREATE POLICY "Admins and Editors can update any article"
ON public.articles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role)
);

CREATE POLICY "Contributors can update their own drafts"
ON public.articles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'contributor'::app_role) AND 
  status = 'draft'
);

CREATE POLICY "Admins and Editors can delete articles"
ON public.articles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_target ON public.audit_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON public.audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);