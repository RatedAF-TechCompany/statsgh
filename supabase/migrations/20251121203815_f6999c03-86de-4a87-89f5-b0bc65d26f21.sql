-- Update handle_new_user to always assign admin role for development
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  -- Always assign admin role for development/preview
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'admin');
  
  RETURN new;
END;
$function$;