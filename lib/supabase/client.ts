/**
 * Supabase Client
 *
 * Lean export of the Supabase client.
 * All types are imported from lib/types.ts.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Re-export types from lib/types.ts for backward compatibility
export type {
  Customer,
  Lead,
  Interaction,
  Note,
  FollowUp,
  Task,
  Activity,
  ChatMessage,
  Profile,
  ScoreFactors,
  ScoringWeights,
  CustomerStatus,
  LeadStatus,
  LeadTemperature,
  TaskStatus,
  TaskPriority,
  FollowUpStatus,
  EntityType,
  InteractionType,
  InteractionDirection,
  ActivityType,
} from '@/lib/types';

export type UserRole = 'admin' | 'manager' | 'sales_rep';
