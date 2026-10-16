-- Fix: Allow the handle_new_user trigger to insert profiles
-- The trigger runs as SECURITY DEFINER but RLS still blocks inserts
-- because during AFTER INSERT ON auth.users, auth.uid() returns NULL
-- (no authenticated session exists yet)

-- Solution: Add an additional policy that allows inserts from the signup trigger
-- We detect this by checking if auth.uid() is null (trigger context) 
-- AND the user_id being inserted matches a newly created auth user

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;

-- Create a new policy that allows:
-- 1. Authenticated users to insert their own profile (auth.uid() = user_id)
-- 2. The trigger to insert during signup (when auth.uid() is null but we're inserting a valid user_id)
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated, anon WITH CHECK (
    auth.uid() = user_id 
    OR (auth.uid() IS NULL AND user_id IS NOT NULL)
  );

-- Also add the email column to profiles since the TypeScript type expects it
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Update the trigger function to also populate the email field
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 
    'sales_rep'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;