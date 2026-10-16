/**
 * Customer Service
 *
 * Data access layer for customer operations.
 * All functions return ServiceResponse and never throw.
 */

import { supabase } from '@/lib/supabase/client';
import {
  Customer,
  ServiceResponse,
  PaginatedResponse,
  PaginationParams,
  SortParams,
  FilterParams,
  TimelineItem,
  CustomerHealth,
} from '@/lib/types';
import { getCurrentUserId, handleServiceError, buildPaginationRange, arrayToCSV } from './base';

/**
 * Get paginated list of customers
 */
export async function getCustomers(
  params?: PaginationParams & SortParams & FilterParams
): Promise<PaginatedResponse<Customer>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated', pagination: { page: 1, pageSize: 25, total: 0, hasMore: false } };
  }

  try {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const { from, to } = buildPaginationRange(page, pageSize);

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order(params?.field || 'created_at', { ascending: params?.direction === 'asc' })
      .range(from, to);

    // Apply filters
    if (params?.status) {
      query = query.eq('status', params.status as string);
    }
    if (params?.industry) {
      query = query.eq('industry', params.industry as string);
    }

    const { data, error, count } = await query;

    if (error) {
      return handleServiceError(error, 'getCustomers') as PaginatedResponse<Customer>;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: data as Customer[],
      error: null,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    return handleServiceError(error, 'getCustomers') as PaginatedResponse<Customer>;
  }
}

/**
 * Get a single customer by ID
 */
export async function getCustomerById(id: string): Promise<ServiceResponse<Customer>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).eq('user_id', userId).single();

    if (error) {
      return handleServiceError(error, 'getCustomerById');
    }

    return { data: data as Customer, error: null };
  } catch (error) {
    return handleServiceError(error, 'getCustomerById');
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(
  customerData: Omit<Customer, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<ServiceResponse<Customer>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...customerData, user_id: userId })
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'createCustomer');
    }

    return { data: data as Customer, error: null };
  } catch (error) {
    return handleServiceError(error, 'createCustomer');
  }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<ServiceResponse<Customer>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'updateCustomer');
    }

    return { data: data as Customer, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateCustomer');
  }
}

/**
 * Delete a customer
 */
export async function deleteCustomer(id: string): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('customers').delete().eq('id', id).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteCustomer');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteCustomer');
  }
}

/**
 * Delete multiple customers
 */
export async function deleteCustomers(ids: string[]): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('customers').delete().in('id', ids).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteCustomers');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteCustomers');
  }
}

/**
 * Update status for multiple customers
 */
export async function updateCustomersStatus(
  ids: string[],
  status: Customer['status']
): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase
      .from('customers')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'updateCustomersStatus');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateCustomersStatus');
  }
}

/**
 * Get customer timeline (notes, follow-ups, tasks)
 */
export async function getCustomerTimeline(customerId: string): Promise<ServiceResponse<TimelineItem[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    // Fetch notes, follow-ups, and tasks in parallel
    const [notesRes, followUpsRes, tasksRes] = await Promise.all([
      supabase.from('notes').select('*').eq('entity_type', 'customer').eq('entity_id', customerId).eq('user_id', userId),
      supabase
        .from('follow_ups')
        .select('*')
        .eq('entity_type', 'customer')
        .eq('entity_id', customerId)
        .eq('user_id', userId),
      supabase.from('tasks').select('*').eq('customer_id', customerId).eq('user_id', userId),
    ]);

    const timeline: TimelineItem[] = [];

    // Map notes
    (notesRes.data || []).forEach((note) => {
      timeline.push({
        id: note.id,
        type: 'note',
        title: 'Note added',
        description: note.content,
        occurred_at: note.created_at,
        metadata: {},
      });
    });

    // Map follow-ups
    (followUpsRes.data || []).forEach((followUp) => {
      timeline.push({
        id: followUp.id,
        type: 'follow_up',
        title: followUp.title,
        description: followUp.description,
        occurred_at: followUp.created_at,
        metadata: { status: followUp.status, due_date: followUp.due_date },
      });
    });

    // Map tasks
    (tasksRes.data || []).forEach((task) => {
      timeline.push({
        id: task.id,
        type: 'task',
        title: task.title,
        description: task.description,
        occurred_at: task.created_at,
        metadata: { status: task.status, priority: task.priority },
      });
    });

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

    return { data: timeline, error: null };
  } catch (error) {
    return handleServiceError(error, 'getCustomerTimeline');
  }
}

/**
 * Calculate customer health score (pure function)
 */
export function getCustomerHealth(customer: Customer, timeline: TimelineItem[]): CustomerHealth {
  const now = new Date();
  const lastActivity = timeline[0]?.occurred_at || customer.created_at;
  const daysSinceContact = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

  // Calculate health score based on various factors
  let score = 100;

  // Penalize for lack of contact
  if (daysSinceContact > 60) {
    score -= 40;
  } else if (daysSinceContact > 30) {
    score -= 25;
  } else if (daysSinceContact > 14) {
    score -= 10;
  }

  // Penalize for churned status
  if (customer.status === 'churned') {
    score = Math.min(score, 20);
  } else if (customer.status === 'inactive') {
    score = Math.min(score, 40);
  } else if (customer.status === 'prospect') {
    score = Math.min(score, 70);
  }

  // Bonus for high value
  if ((customer.value || 0) > 50000) {
    score += 10;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine churn risk
  let churnRisk: 'low' | 'medium' | 'high';
  if (score < 40 || customer.status === 'churned') {
    churnRisk = 'high';
  } else if (score < 70) {
    churnRisk = 'medium';
  } else {
    churnRisk = 'low';
  }

  // Determine trend (simplified - would need historical data for real trend)
  let trend: 'improving' | 'stable' | 'declining';
  if (daysSinceContact < 7) {
    trend = 'improving';
  } else if (daysSinceContact > 21) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (daysSinceContact > 30) {
    recommendations.push('Schedule a check-in call soon');
  }
  if (customer.status === 'prospect') {
    recommendations.push('Convert to active customer to increase engagement');
  }
  if (churnRisk === 'high') {
    recommendations.push('Consider a win-back campaign');
  }
  if (recommendations.length === 0) {
    recommendations.push('Continue current engagement strategy');
  }

  return {
    score,
    trend,
    churnRisk,
    lastEngagement: lastActivity,
    summary:
      score >= 80
        ? 'Healthy customer relationship'
        : score >= 60
          ? 'Relationship needs attention'
          : 'At risk of churn',
    recommendations,
  };
}

/**
 * Export customers to CSV
 */
export async function exportCustomersCSV(filters?: FilterParams): Promise<ServiceResponse<string>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    let query = supabase.from('customers').select('*').eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status as string);
    }

    const { data, error } = await query;

    if (error) {
      return handleServiceError(error, 'exportCustomersCSV');
    }

    const csv = arrayToCSV(data as Customer[], [
      'name',
      'company',
      'email',
      'phone',
      'industry',
      'status',
      'value',
      'created_at',
    ]);

    return { data: csv, error: null };
  } catch (error) {
    return handleServiceError(error, 'exportCustomersCSV');
  }
}
