/**
 * React Query hooks for customer operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  deleteCustomers,
  updateCustomersStatus,
  getCustomerTimeline,
  exportCustomersCSV,
} from '@/services/customers';
import { Customer, PaginationParams, SortParams, FilterParams, TimelineItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Query keys
export const CUSTOMER_KEYS = {
  all: ['customers'] as const,
  lists: () => [...CUSTOMER_KEYS.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...CUSTOMER_KEYS.lists(), params] as const,
  details: () => [...CUSTOMER_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CUSTOMER_KEYS.details(), id] as const,
  timeline: (id: string) => [...CUSTOMER_KEYS.detail(id), 'timeline'] as const,
};

interface UseCustomersOptions {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  status?: string;
  industry?: string;
}

/**
 * Hook to fetch paginated customers
 */
export function useCustomers(options: UseCustomersOptions = {}) {
  const params: Record<string, unknown> = {};

  if (options.page !== undefined) params.page = options.page;
  if (options.pageSize !== undefined) params.pageSize = options.pageSize;
  if (options.sortField) params.field = options.sortField;
  if (options.sortDirection) params.direction = options.sortDirection;
  if (options.status) params.status = options.status;
  if (options.industry) params.industry = options.industry;

  return useQuery({
    queryKey: CUSTOMER_KEYS.list(params),
    queryFn: () => getCustomers(params as PaginationParams & SortParams & FilterParams),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch a single customer
 */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.detail(id),
    queryFn: () => getCustomerById(id),
    enabled: !!id,
  });
}

// Alias for consistency
export const useCustomerById = useCustomer;

/**
 * Hook to fetch customer timeline
 */
export function useCustomerTimeline(id: string) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.timeline(id),
    queryFn: () => getCustomerTimeline(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a customer
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<Customer, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      toast({ title: 'Customer created', description: 'The customer has been added successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create customer', variant: 'destructive' });
    },
  });
}

/**
 * Hook to update a customer
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) => updateCustomer(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      toast({ title: 'Customer updated', description: 'Changes saved successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update customer', variant: 'destructive' });
    },
  });
}

/**
 * Hook to delete a customer
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      toast({ title: 'Customer deleted', description: 'The customer has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete customer', variant: 'destructive' });
    },
  });
}

/**
 * Hook to bulk delete customers
 */
export function useDeleteCustomers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) => deleteCustomers(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      toast({ title: 'Customers deleted', description: 'Selected customers have been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete customers', variant: 'destructive' });
    },
  });
}

/**
 * Hook to bulk update customer status
 */
export function useUpdateCustomersStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: Customer['status'] }) =>
      updateCustomersStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.lists() });
      toast({ title: 'Status updated', description: 'Customer statuses have been changed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update status', variant: 'destructive' });
    },
  });
}

/**
 * Hook to export customers as CSV
 */
export function useExportCustomersCSV() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (filters?: FilterParams) => exportCustomersCSV(filters),
    onSuccess: (result) => {
      if (result.data) {
        // Trigger download
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
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
