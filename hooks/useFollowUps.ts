/**
 * React Query hooks for follow-up operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFollowUps,
  getFollowUpById,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  completeFollowUp,
  getFollowUpsByEntity,
  getPendingFollowUps,
  getUpcomingFollowUps,
} from '@/services/follow-ups';
import { FollowUp, EntityType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type { FollowUp };

// Query keys
export const FOLLOWUP_KEYS = {
  all: ['followUps'] as const,
  lists: () => [...FOLLOWUP_KEYS.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...FOLLOWUP_KEYS.lists(), params] as const,
  details: () => [...FOLLOWUP_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FOLLOWUP_KEYS.details(), id] as const,
  byEntity: (entityType: string, entityId: string) => [...FOLLOWUP_KEYS.all, 'entity', entityType, entityId] as const,
  pending: () => [...FOLLOWUP_KEYS.all, 'pending'] as const,
  upcoming: () => [...FOLLOWUP_KEYS.all, 'upcoming'] as const,
};

/**
 * Hook to fetch paginated follow-ups
 */
export function useFollowUps(params?: { page?: number; pageSize?: number; status?: string }) {
  return useQuery({
    queryKey: FOLLOWUP_KEYS.list(params),
    queryFn: () => getFollowUps(params),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single follow-up
 */
export function useFollowUp(id: string) {
  return useQuery({
    queryKey: FOLLOWUP_KEYS.detail(id),
    queryFn: () => getFollowUpById(id),
    enabled: !!id,
  });
}

/**
 * Hook to fetch follow-ups for a specific entity
 */
export function useFollowUpsByEntity(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: FOLLOWUP_KEYS.byEntity(entityType, entityId),
    queryFn: () => getFollowUpsByEntity(entityType, entityId),
    enabled: !!entityId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch pending follow-ups
 */
export function usePendingFollowUps() {
  return useQuery({
    queryKey: FOLLOWUP_KEYS.pending(),
    queryFn: () => getPendingFollowUps(),
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to fetch upcoming follow-ups
 */
export function useUpcomingFollowUps(days?: number) {
  return useQuery({
    queryKey: FOLLOWUP_KEYS.upcoming(),
    queryFn: () => getUpcomingFollowUps(days),
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to create a follow-up
 */
export function useCreateFollowUp() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { entityType: EntityType; entityId: string; title: string; dueDate: string; description?: string | null }) =>
      createFollowUp(data.entityType, data.entityId, data.title, data.dueDate, data.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.pending() });
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.upcoming() });
      toast({ title: 'Follow-up scheduled', description: 'Follow-up has been created.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create follow-up', variant: 'destructive' });
    },
  });
}

/**
 * Hook to update a follow-up
 */
export function useUpdateFollowUp() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<FollowUp, 'title' | 'description' | 'due_date' | 'status'>> }) =>
      updateFollowUp(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.lists() });
      toast({ title: 'Follow-up updated', description: 'Changes saved successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update follow-up', variant: 'destructive' });
    },
  });
}

/**
 * Hook to delete a follow-up
 */
export function useDeleteFollowUp() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteFollowUp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.lists() });
      toast({ title: 'Follow-up deleted', description: 'The follow-up has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete follow-up', variant: 'destructive' });
    },
  });
}

/**
 * Hook to complete a follow-up
 */
export function useCompleteFollowUp() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => completeFollowUp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_KEYS.pending() });
      toast({ title: 'Follow-up completed', description: 'Great job!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to complete follow-up', variant: 'destructive' });
    },
  });
}
