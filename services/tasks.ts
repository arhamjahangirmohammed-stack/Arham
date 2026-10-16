/**
 * Task Service
 *
 * Data access layer for task operations.
 * All functions return ServiceResponse and never throw.
 */

import { supabase } from '@/lib/supabase/client';
import { Task, ServiceResponse, PaginatedResponse, PaginationParams, SortParams, FilterParams } from '@/lib/types';
import { getCurrentUserId, handleServiceError, buildPaginationRange } from './base';

/**
 * Get paginated list of tasks
 */
export async function getTasks(
  params?: PaginationParams & SortParams & FilterParams
): Promise<PaginatedResponse<Task>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated', pagination: { page: 1, pageSize: 25, total: 0, hasMore: false } };
  }

  try {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const { from, to } = buildPaginationRange(page, pageSize);

    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order(params?.field || 'due_date', { ascending: params?.direction !== 'desc' })
      .range(from, to);

    // Apply filters
    if (params?.status) {
      query = query.eq('status', params.status as string);
    }
    if (params?.priority) {
      query = query.eq('priority', params.priority as string);
    }

    const { data, error, count } = await query;

    if (error) {
      return handleServiceError(error, 'getTasks') as PaginatedResponse<Task>;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: data as Task[],
      error: null,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    return handleServiceError(error, 'getTasks') as PaginatedResponse<Task>;
  }
}

/**
 * Get a single task by ID
 */
export async function getTaskById(id: string): Promise<ServiceResponse<Task>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).eq('user_id', userId).single();

    if (error) {
      return handleServiceError(error, 'getTaskById');
    }

    return { data: data as Task, error: null };
  } catch (error) {
    return handleServiceError(error, 'getTaskById');
  }
}

/**
 * Create a new task
 */
export async function createTask(taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ServiceResponse<Task>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...taskData, user_id: userId })
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'createTask');
    }

    return { data: data as Task, error: null };
  } catch (error) {
    return handleServiceError(error, 'createTask');
  }
}

/**
 * Update an existing task
 */
export async function updateTask(id: string, updates: Partial<Task>): Promise<ServiceResponse<Task>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'updateTask');
    }

    return { data: data as Task, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateTask');
  }
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteTask');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteTask');
  }
}

/**
 * Delete multiple tasks
 */
export async function deleteTasks(ids: string[]): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('tasks').delete().in('id', ids).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteTasks');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteTasks');
  }
}

/**
 * Mark a task as completed
 */
export async function completeTask(id: string): Promise<ServiceResponse<Task>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'completeTask');
    }

    return { data: data as Task, error: null };
  } catch (error) {
    return handleServiceError(error, 'completeTask');
  }
}

/**
 * Mark multiple tasks as completed
 */
export async function completeTasks(ids: string[]): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'completeTasks');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'completeTasks');
  }
}

/**
 * Get today's tasks (due today and not completed)
 */
export async function getTodaysTasks(): Promise<ServiceResponse<Task[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .eq('due_date', today)
      .order('priority', { ascending: false });

    if (error) {
      return handleServiceError(error, 'getTodaysTasks');
    }

    return { data: data as Task[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getTodaysTasks');
  }
}

/**
 * Get overdue tasks (due before today and not completed)
 */
export async function getOverdueTasks(): Promise<ServiceResponse<Task[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', today)
      .order('due_date', { ascending: true });

    if (error) {
      return handleServiceError(error, 'getOverdueTasks');
    }

    return { data: data as Task[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getOverdueTasks');
  }
}

/**
 * Get tasks count by status
 */
export async function getTaskCountsByStatus(): Promise<ServiceResponse<Record<string, number>>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase.from('tasks').select('status').eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'getTaskCountsByStatus');
    }

    const counts: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    (data || []).forEach((task) => {
      const status = task.status as string;
      if (status in counts) {
        counts[status]++;
      }
    });

    return { data: counts, error: null };
  } catch (error) {
    return handleServiceError(error, 'getTaskCountsByStatus');
  }
}

/**
 * Get all tasks for a specific entity
 */
export async function getTasksByEntity(
  entityType: string,
  entityId: string
): Promise<ServiceResponse<Task[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      return handleServiceError(error, 'getTasksByEntity');
    }

    return { data: data as Task[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getTasksByEntity');
  }
}
