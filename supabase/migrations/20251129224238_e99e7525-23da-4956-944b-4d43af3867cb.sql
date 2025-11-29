-- Update handle_new_user function to only assign admin role to master email
-- All other signups get 'user' role and cannot access dashboard
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  -- Only assign admin role to master account email
  IF new.email = 'officeofnajib@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  ELSE
    -- All other signups get 'user' role (no dashboard access)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'user');
  END IF;
  
  RETURN new;
END;
$function$;

-- Update user_invitations to only allow admin to create invitations
DROP POLICY IF EXISTS "Admins can manage invitations" ON user_invitations;

CREATE POLICY "Only admin can manage invitations"
  ON user_invitations FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Update user_roles policies to prevent non-admins from viewing all roles
DROP POLICY IF EXISTS "Anyone can view user roles" ON user_roles;

CREATE POLICY "Users can view own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));