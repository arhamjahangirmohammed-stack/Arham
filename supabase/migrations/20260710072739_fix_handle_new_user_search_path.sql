-- Fix: The handle_new_user() trigger function referenced `profiles` without
-- a schema qualifier and had no pinned search_path. During the
-- on_auth_user_created trigger, the search_path does not include `public`,
-- so the INSERT failed with "Database error saving user" on signup.
-- Recreate the function with SET search_path = public and schema-qualified table.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'sales_rep'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
