/*
# CRM Schema Extension — Tasks, Activity Timeline, Audit Logs, Roles, Embeddings

1. Overview
Extends the CRM schema with:
- User profiles with role-based access control (admin, manager, sales_rep)
- Tasks module (assignable, prioritized, linked to customers/leads)
- Activity timeline (unified log of all CRM events)
- Audit logs for tracking important actions
- Embeddings storage for RAG (vector similarity search)
- Scoring weights table for configurable AI lead scoring

2. New Tables
- `profiles` — user profile with role, linked to auth.users
- `tasks` — assignable tasks with priority, due date, status, linked to customer/lead
- `activities` — unified activity timeline (type, entity, description, metadata)
- `audit_logs` — audit trail of important user actions
- `embeddings` — vector embeddings for RAG semantic search
- `scoring_weights` — configurable weights for the lead scoring algorithm

3. Security
- RLS enabled on ALL new tables.
- Owner-scoped CRUD where appropriate.
- Profiles: users can read all profiles (for task assignment), update only their own.
- Tasks: owner + assignee can access.
- Activities: owner-scoped.
- Audit logs: admin-only read, system insert.
- Embeddings: owner-scoped.
- Scoring weights: all authenticated can read, admin can update.
*/

-- ============================================================
-- PROFILES (role-based access control)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'sales_rep' CHECK (role IN ('admin', 'manager', 'sales_rep')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )) WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
  ));

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  entity_type text CHECK (entity_type IN ('customer', 'lead', 'none')),
  entity_id uuid,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = assigned_to);

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = assigned_to);

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- ACTIVITIES (unified timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'note_added', 'lead_created', 'lead_updated', 'lead_status_changed',
    'customer_created', 'customer_updated', 'interaction_logged',
    'task_created', 'task_completed', 'task_assigned',
    'follow_up_scheduled', 'follow_up_completed',
    'email_sent', 'email_generated', 'meeting_scheduled',
    'score_updated', 'ai_query'
  )),
  entity_type text CHECK (entity_type IN ('customer', 'lead', 'task', 'follow_up', 'interaction', 'none')),
  entity_id uuid,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activities" ON activities;
CREATE POLICY "select_own_activities" ON activities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activities" ON activities;
CREATE POLICY "insert_own_activities" ON activities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activities" ON activities;
CREATE POLICY "delete_own_activities" ON activities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_logs_admin" ON audit_logs;
CREATE POLICY "select_audit_logs_admin" ON audit_logs FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
  ));

DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- EMBEDDINGS (RAG vector storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('customer', 'lead', 'note', 'interaction', 'task', 'activity')),
  entity_id uuid NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_embeddings" ON embeddings;
CREATE POLICY "select_own_embeddings" ON embeddings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_embeddings" ON embeddings;
CREATE POLICY "insert_own_embeddings" ON embeddings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_embeddings" ON embeddings;
CREATE POLICY "update_own_embeddings" ON embeddings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_embeddings" ON embeddings;
CREATE POLICY "delete_own_embeddings" ON embeddings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id);

-- ============================================================
-- SCORING WEIGHTS (configurable lead scoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS scoring_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  industry_weight numeric NOT NULL DEFAULT 20 CHECK (industry_weight >= 0 AND industry_weight <= 100),
  company_size_weight numeric NOT NULL DEFAULT 20 CHECK (company_size_weight >= 0 AND company_size_weight <= 100),
  interaction_count_weight numeric NOT NULL DEFAULT 20 CHECK (interaction_count_weight >= 0 AND interaction_count_weight <= 100),
  email_reply_weight numeric NOT NULL DEFAULT 20 CHECK (email_reply_weight >= 0 AND email_reply_weight <= 100),
  meeting_count_weight numeric NOT NULL DEFAULT 20 CHECK (meeting_count_weight >= 0 AND meeting_count_weight <= 100),
  last_contact_weight numeric NOT NULL DEFAULT 0 CHECK (last_contact_weight >= 0 AND last_contact_weight <= 100),
  lead_status_weight numeric NOT NULL DEFAULT 0 CHECK (lead_status_weight >= 0 AND lead_status_weight <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scoring_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scoring_weights" ON scoring_weights;
CREATE POLICY "select_own_scoring_weights" ON scoring_weights FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_scoring_weights" ON scoring_weights;
CREATE POLICY "insert_own_scoring_weights" ON scoring_weights FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_scoring_weights" ON scoring_weights;
CREATE POLICY "update_own_scoring_weights" ON scoring_weights FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS scoring_weights_updated_at ON scoring_weights;
CREATE TRIGGER scoring_weights_updated_at BEFORE UPDATE ON scoring_weights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS embeddings_updated_at ON embeddings;
CREATE TRIGGER embeddings_updated_at BEFORE UPDATE ON embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'sales_rep')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
