/**
 * React Query hooks for lead operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  deleteLeads,
  updateLeadsStatus,
  updateLeadsTemperature,
  getLeadTimeline,
  getDealsAtRisk,
  getLeadsClosingSoon,
  getInteractionsByLeadId,
  createInteraction,
  exportLeadsCSV,
} from '@/services/leads';
import { Lead, Interaction, PaginationParams, SortParams, FilterParams } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Query keys
export const LEAD_KEYS = {
  all: ['leads'] as const,
  lists: () => [...LEAD_KEYS.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...LEAD_KEYS.lists(), params] as const,
  details: () => [...LEAD_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...LEAD_KEYS.details(), id] as const,
  timeline: (id: string) => [...LEAD_KEYS.detail(id), 'timeline'] as const,
  interactions: (id: string) => [...LEAD_KEYS.detail(id), 'interactions'] as const,
  atRisk: () => [...LEAD_KEYS.all, 'atRisk'] as const,
  closingSoon: () => [...LEAD_KEYS.all, 'closingSoon'] as const,
};

interface UseLeadsOptions {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  status?: string;
  temperature?: string;
  industry?: string;
}

/**
 * Hook to fetch paginated leads
 */
export function useLeads(options: UseLeadsOptions = {}) {
  const params: Record<string, unknown> = {};

  if (options.page !== undefined) params.page = options.page;
  if (options.pageSize !== undefined) params.pageSize = options.pageSize;
  if (options.sortField) params.field = options.sortField;
  if (options.sortDirection) params.direction = options.sortDirection;
  if (options.status) params.status = options.status;
  if (options.temperature) params.temperature = options.temperature;
  if (options.industry) params.industry = options.industry;

  return useQuery({
    queryKey: LEAD_KEYS.list(params),
    queryFn: () => getLeads(params as PaginationParams & SortParams & FilterParams),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single lead
 */
export function useLead(id: string) {
  return useQuery({
    queryKey: LEAD_KEYS.detail(id),
    queryFn: () => getLeadById(id),
    enabled: !!id,
  });
}

// Alias for consistency
export const useLeadById = useLead;

/**
 * Hook to fetch lead timeline
 */
export function useLeadTimeline(id: string) {
  return useQuery({
    queryKey: LEAD_KEYS.timeline(id),
    queryFn: () => getLeadTimeline(id),
    enabled: !!id,
  });
}

/**
 * Hook to fetch lead interactions
 */
export function useLeadInteractions(id: string) {
  return useQuery({
    queryKey: LEAD_KEYS.interactions(id),
    queryFn: () => getInteractionsByLeadId(id),
    enabled: !!id,
  });
}

// Alias for consistency
export const useInteractionsByLeadId = useLeadInteractions;

/**
 * Hook to fetch deals at risk
 */
export function useDealsAtRisk() {
  return useQuery({
    queryKey: LEAD_KEYS.atRisk(),
    queryFn: () => getDealsAtRisk(),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch leads closing soon
 */
export function useLeadsClosingSoon() {
  return useQuery({
    queryKey: LEAD_KEYS.closingSoon(),
    queryFn: () => getLeadsClosingSoon(),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to create a lead
 */
export function useCreateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<Lead, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.lists() });
      toast({ title: 'Lead created', description: 'The lead has been added successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create lead', variant: 'destructive' });
    },
  });
}

/**
 * Hook to update a lead
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Lead> }) => updateLead(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.lists() });
      toast({ title: 'Lead updated', description: 'Changes saved successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update lead', variant: 'destructive' });
    },
  });
}

/**
 * Hook to delete a lead
 */
export function useDeleteLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.lists() });
      toast({ title: 'Lead deleted', description: 'The lead has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete lead', variant: 'destructive' });
    },
  });
}

/**
 * Hook to bulk delete leads
 */
export function useDeleteLeads() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) => deleteLeads(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.lists() });
      toast({ title: 'Leads deleted', description: 'Selected leads have been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete leads', variant: 'destructive' });
    },
  });
}

/**
 * Hook to bulk update lead status
 */
export function useUpdateLeadsStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: Lead['status'] }) =>
      updateLeadsStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.lists() });
      toast({ title: 'Status updated', description: 'Lead statuses have been changed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update status', variant: 'destructive' });
    },
  });
}

/**
 * Hook to bulk update lead temperature
 */
export function useUpdateLeadsTemperature() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ ids, temperature }: { ids: string[]; temperature: Lead['temperature'] }) =>
      updateLeadsTemperature(ids, temperature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.lists() });
      toast({ title: 'Temperature updated', description: 'Lead temperatures have been changed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update temperature', variant: 'destructive' });
    },
  });
}

/**
 * Hook to create an interaction
 */
export function useCreateInteraction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<Interaction, 'id' | 'user_id' | 'created_at'>) => createInteraction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.interactions(variables.lead_id) });
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.detail(variables.lead_id) });
      queryClient.invalidateQueries({ queryKey: LEAD_KEYS.timeline(variables.lead_id) });
      toast({ title: 'Interaction logged', description: 'Interaction has been recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to log interaction', variant: 'destructive' });
    },
  });
}

/**
 * Hook to export leads as CSV
 */
export function useExportLeadsCSV() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (filters?: FilterParams) => exportLeadsCSV(filters),
    onSuccess: (result) => {
      if (result.data) {
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast({ title: 'Export complete', description: 'CSV file downloaded.' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to export', variant: 'destructive' });
    },
  });
}
