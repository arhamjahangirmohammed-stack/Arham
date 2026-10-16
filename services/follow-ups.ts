/**
 * Follow-Ups Service
 *
 * Data access layer for follow-up operations.
 * All functions return ServiceResponse and never throw.
 */

import { supabase } from '@/lib/supabase/client';
import { FollowUp, ServiceResponse, PaginatedResponse, PaginationParams, EntityType } from '@/lib/types';
import { getCurrentUserId, handleServiceError, buildPaginationRange } from './base';

/**
 * Get all follow-ups for a specific entity
 */
export async function getFollowUpsByEntity(
  entityType: EntityType,
  entityId: string
): Promise<ServiceResponse<FollowUp[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('due_date', { ascending: true });

    if (error) {
      return handleServiceError(error, 'getFollowUpsByEntity');
    }

    return { data: data as FollowUp[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getFollowUpsByEntity');
  }
}

/**
 * Get paginated list of follow-ups
 */
export async function getFollowUps(
  params?: PaginationParams & { status?: string }
): Promise<PaginatedResponse<FollowUp>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated', pagination: { page: 1, pageSize: 25, total: 0, hasMore: false } };
  }

  try {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const { from, to } = buildPaginationRange(page, pageSize);

    let query = supabase
      .from('follow_ups')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .range(from, to);

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    const { data, error, count } = await query;

    if (error) {
      return handleServiceError(error, 'getFollowUps') as PaginatedResponse<FollowUp>;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: data as FollowUp[],
      error: null,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    return handleServiceError(error, 'getFollowUps') as PaginatedResponse<FollowUp>;
  }
}

/**
 * Get a single follow-up by ID
 */
export async function getFollowUpById(id: string): Promise<ServiceResponse<FollowUp>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      return handleServiceError(error, 'getFollowUpById');
    }

    return { data: data as FollowUp, error: null };
  } catch (error) {
    return handleServiceError(error, 'getFollowUpById');
  }
}

/**
 * Create a new follow-up
 */
export async function createFollowUp(
  entityType: EntityType,
  entityId: string,
  title: string,
  dueDate: string,
  description?: string | null
): Promise<ServiceResponse<FollowUp>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .insert({
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        title,
        description: description || null,
        due_date: dueDate,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'createFollowUp');
    }

    return { data: data as FollowUp, error: null };
  } catch (error) {
    return handleServiceError(error, 'createFollowUp');
  }
}

/**
 * Update a follow-up
 */
export async function updateFollowUp(
  id: string,
  updates: Partial<Pick<FollowUp, 'title' | 'description' | 'due_date' | 'status'>>
): Promise<ServiceResponse<FollowUp>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'updateFollowUp');
    }

    return { data: data as FollowUp, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateFollowUp');
  }
}

/**
 * Delete a follow-up
 */
export async function deleteFollowUp(id: string): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('follow_ups').delete().eq('id', id).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteFollowUp');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteFollowUp');
  }
}

/**
 * Mark a follow-up as completed
 */
export async function completeFollowUp(id: string): Promise<ServiceResponse<FollowUp>> {
  return updateFollowUp(id, { status: 'completed' });
}

/**
 * Get pending follow-ups (due today or overdue)
 */
export async function getPendingFollowUps(): Promise<ServiceResponse<FollowUp[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lte('due_date', today)
      .order('due_date', { ascending: true });

    if (error) {
      return handleServiceError(error, 'getPendingFollowUps');
    }

    return { data: data as FollowUp[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getPendingFollowUps');
  }
}

/**
 * Get upcoming follow-ups (due in the next N days)
 */
export async function getUpcomingFollowUps(days: number = 7): Promise<ServiceResponse<FollowUp[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);

    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (error) {
      return handleServiceError(error, 'getUpcomingFollowUps');
    }

    return { data: data as FollowUp[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getUpcomingFollowUps');
  }
}
