/**
 * React Query hooks for task operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  deleteTasks,
  completeTask,
  completeTasks,
  getTodaysTasks,
  getOverdueTasks,
  getTasksByEntity,
} from '@/services/tasks';
import { Task, PaginationParams, SortParams, FilterParams } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type { Task };

// Query keys
export const TASK_KEYS = {
  all: ['tasks'] as const,
  lists: () => [...TASK_KEYS.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...TASK_KEYS.lists(), params] as const,
  details: () => [...TASK_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...TASK_KEYS.details(), id] as const,
  today: () => [...TASK_KEYS.all, 'today'] as const,
  overdue: () => [...TASK_KEYS.all, 'overdue'] as const,
  byEntity: (entityType: string, entityId: string) => [...TASK_KEYS.all, 'entity', entityType, entityId] as const,
};

interface UseTasksOptions {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  status?: string;
  priority?: string;
}

/**
 * Hook to fetch paginated tasks
 */
export function useTasks(options: UseTasksOptions = {}) {
  const params: Record<string, unknown> = {};

  if (options.page !== undefined) params.page = options.page;
  if (options.pageSize !== undefined) params.pageSize = options.pageSize;
  if (options.sortField) params.field = options.sortField;
  if (options.sortDirection) params.direction = options.sortDirection;
  if (options.status) params.status = options.status;
  if (options.priority) params.priority = options.priority;

  return useQuery({
    queryKey: TASK_KEYS.list(params),
    queryFn: () => getTasks(params as PaginationParams & SortParams & FilterParams),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single task
 */
export function useTask(id: string) {
  return useQuery({
    queryKey: TASK_KEYS.detail(id),
    queryFn: () => getTaskById(id),
    enabled: !!id,
  });
}

/**
 * Hook to fetch today's tasks
 */
export function useTodaysTasks() {
  return useQuery({
    queryKey: TASK_KEYS.today(),
    queryFn: () => getTodaysTasks(),
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to fetch overdue tasks
 */
export function useOverdueTasks() {
  return useQuery({
    queryKey: TASK_KEYS.overdue(),
    queryFn: () => getOverdueTasks(),
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to create a task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<Task> & { title: string }) => createTask({
      title: data.title,
      description: data.description || null,
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      due_date: data.due_date || null,
      customer_id: data.customer_id || null,
      entity_type: data.entity_type || null,
      entity_id: data.entity_id || null,
      assigned_to: data.assigned_to || null,
      completed_at: null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.today() });
      toast({ title: 'Task created', description: 'The task has been added successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create task', variant: 'destructive' });
    },
  });
}

/**
 * Hook to update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.today() });
      toast({ title: 'Task updated', description: 'Changes saved successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update task', variant: 'destructive' });
    },
  });
}

/**
 * Hook to delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.today() });
      toast({ title: 'Task deleted', description: 'The task has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete task', variant: 'destructive' });
    },
  });
}

/**
 * Hook to bulk delete tasks
 */
export function useDeleteTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) => deleteTasks(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.today() });
      toast({ title: 'Tasks deleted', description: 'Selected tasks have been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete tasks', variant: 'destructive' });
    },
  });
}

/**
 * Hook to complete a task
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.today() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.overdue() });
      toast({ title: 'Task completed', description: 'Great job!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to complete task', variant: 'destructive' });
    },
  });
}

/**
 * Hook to bulk complete tasks
 */
export function useCompleteTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) => completeTasks(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.today() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.overdue() });
      toast({ title: 'Tasks completed', description: 'All selected tasks marked as done.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to complete tasks', variant: 'destructive' });
    },
  });
}

/**
 * Hook to fetch tasks for a specific entity
 */
export function useTasksByEntity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: TASK_KEYS.byEntity(entityType, entityId),
    queryFn: () => getTasksByEntity(entityType, entityId),
    enabled: !!entityId,
    staleTime: 1000 * 60 * 2,
  });
}
