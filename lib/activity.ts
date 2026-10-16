import { supabase } from '@/lib/supabase/client';
import { ActivityType } from '@/lib/supabase/client';

export async function logActivity(params: {
  type: ActivityType;
  entity_type?: 'customer' | 'lead' | 'task' | 'follow_up' | 'interaction' | 'none';
  entity_id?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from('activities').insert({
    user_id: userData.user.id,
    type: params.type,
    entity_type: params.entity_type || 'none',
    entity_id: params.entity_id || null,
    title: params.title,
    description: params.description || null,
    metadata: params.metadata || {},
  });
}

export async function logAudit(params: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from('audit_logs').insert({
    user_id: userData.user.id,
    action: params.action,
    entity_type: params.entity_type || null,
    entity_id: params.entity_id || null,
    old_values: params.old_values || null,
    new_values: params.new_values || null,
  });
}
