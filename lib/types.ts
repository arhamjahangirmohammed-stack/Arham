/**
 * Unified Type System for Nexus CRM
 *
 * All application types are defined here for single-source-of-truth.
 * Database types match Supabase schema; utility types provide common patterns.
 */

// ============================================================
// DATABASE ENTITY TYPES (from Supabase schema)
// ============================================================

export type CustomerStatus = 'active' | 'prospect' | 'churned' | 'inactive';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
export type LeadTemperature = 'cold' | 'warm' | 'hot';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';
export type EntityType = 'customer' | 'lead';
export type InteractionType = 'email' | 'meeting' | 'call' | 'note' | 'demo';
export type InteractionDirection = 'inbound' | 'outbound';

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  status: CustomerStatus;
  value: number | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  company_size: string | null;
  status: LeadStatus;
  temperature: LeadTemperature;
  score: number | null;
  score_factors: ScoreFactors | null;
  estimated_value: number | null;
  source: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  user_id: string;
  lead_id: string;
  type: InteractionType;
  direction: InteractionDirection;
  subject: string | null;
  summary: string | null;
  replied: boolean;
  meeting_booked: boolean;
  occurred_at: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: FollowUpStatus;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  customer_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  entity_type: 'customer' | 'lead' | 'none' | null;
  entity_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  type: ActivityType;
  entity_type: EntityType | 'task' | 'general';
  entity_id: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ActivityType =
  | 'lead_created'
  | 'lead_updated'
  | 'lead_status_changed'
  | 'customer_created'
  | 'customer_updated'
  | 'task_created'
  | 'task_completed'
  | 'task_assigned'
  | 'follow_up_created'
  | 'follow_up_completed'
  | 'follow_up_scheduled'
  | 'interaction_logged'
  | 'note_added'
  | 'score_updated'
  | 'ai_query'
  | 'email_sent'
  | 'email_generated'
  | 'meeting_scheduled';

export interface ChatMessage {
  id: string;
  user_id: string;
  conversation_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  query_result: Record<string, unknown> | null;
  ai_powered: boolean;
  sources: Record<string, unknown>[] | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'sales_rep';
  created_at: string;
  updated_at: string;
}

export interface ScoreFactors {
  industry_score?: number;
  company_size_score?: number;
  status_score?: number;
  interaction_count_score?: number;
  email_replies_score?: number;
  meetings_score?: number;
  recency_score?: number;
}

export interface ScoringWeights {
  industry_weight: number;
  company_size_weight: number;
  interaction_count_weight: number;
  email_reply_weight: number;
  meeting_count_weight: number;
  last_contact_weight: number;
  lead_status_weight: number;
}

// ============================================================
// SERVICE LAYER TYPES
// ============================================================

export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> extends ServiceResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export interface SortParams {
  field?: string;
  direction?: 'asc' | 'desc';
}

export type FilterParams = Record<string, string | number | boolean | null>;

// ============================================================
// AI-SPECIFIC TYPES
// ============================================================

export type AIIntent =
  | 'navigate'
  | 'show_data'
  | 'draft_email'
  | 'create_task'
  | 'create_followup'
  | 'show_insights'
  | 'summarize'
  | 'qualify_lead'
  | 'prioritize'
  | 'detect_risk'
  | 'general_answer';

export interface AIAction {
  type: AIIntent;
  payload: Record<string, unknown>;
  label: string;
  confirmRequired: boolean;
  estimatedDuration?: string;
}

export interface AICommandResult {
  intent: AIIntent;
  response: string;
  actions: AIAction[];
  navigateTo?: string;
  data?: Record<string, unknown>;
  confidence: number;
  executionTime?: number;
}

export interface AIInsight {
  id: string;
  type: 'risk' | 'opportunity' | 'action' | 'trend';
  title: string;
  description: string;
  entity_type: 'lead' | 'customer' | 'task' | 'global';
  entity_id: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionLabel?: string;
  actionType?: AIIntent;
  created_at: string;
}

export interface DealRisk {
  lead_id: string;
  lead_name: string;
  company: string | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  days_since_contact: number | null;
  recommended_action: string;
  urgency: 'immediate' | 'this_week' | 'this_month';
}

export interface LeadQualification {
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: 'pursue' | 'nurture' | 'deprioritize' | 'disqualify';
  nextAction: string;
  estimatedCloseDate?: string;
  confidence: number;
}

export interface EmailDraft {
  subject: string;
  body: string;
  tone: 'formal' | 'friendly' | 'urgent' | 'follow-up';
  callToAction: string;
  estimatedReadTime: string;
}

export interface MeetingSummary {
  summary: string;
  keyPoints: string[];
  actionItems: Array<{ task: string; owner: string; dueDate?: string }>;
  nextSteps: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  followUpRequired: boolean;
}

export interface DailyPriority {
  item: Task | Lead | FollowUp;
  itemType: 'task' | 'lead' | 'followup';
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  estimatedTime: string;
  aiConfidence: number;
}

export interface CustomerHealth {
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  churnRisk: 'low' | 'medium' | 'high';
  lastEngagement: string | null;
  summary: string;
  recommendations: string[];
}

export interface CommandHistoryItem {
  id: string;
  command: string;
  intent: AIIntent;
  timestamp: string;
  success: boolean;
}

export interface TimelineItem {
  id: string;
  type: 'note' | 'email' | 'meeting' | 'call' | 'task' | 'status_change' | 'score_update' | 'follow_up' | 'demo';
  title: string;
  description: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

// ============================================================
// COMPONENT PROP TYPES
// ============================================================

export interface ScoreRingProps {
  score: number;
  size?: number;
  showLabel?: boolean;
  animated?: boolean;
}

export interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================
// UTILITY TYPES
// ============================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type AsyncFunction<T = void> = () => Promise<T>;
