-- Step 1: Add 'viewer' role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';