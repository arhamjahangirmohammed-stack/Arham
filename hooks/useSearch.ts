/**
 * React Query hooks for search operations
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { globalSearch, searchLeads, searchCustomers } from '@/services/search';
import { Lead, Customer } from '@/lib/types';

// Query keys
export const SEARCH_KEYS = {
  all: ['search'] as const,
  global: (query: string) => [...SEARCH_KEYS.all, 'global', query] as const,
  leads: (query: string) => [...SEARCH_KEYS.all, 'leads', query] as const,
  customers: (query: string) => [...SEARCH_KEYS.all, 'customers', query] as const,
};

interface GlobalSearchResult {
  leads: Lead[];
  customers: Customer[];
}

/**
 * Hook for global search with debouncing
 */
export function useGlobalSearch(query: string, debounceMs: number = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const { data, isLoading, isError } = useQuery({
    queryKey: SEARCH_KEYS.global(debouncedQuery),
    queryFn: () => globalSearch(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const results: GlobalSearchResult = data?.data || { leads: [], customers: [] };
  const isEmpty = !isLoading && results.leads.length === 0 && results.customers.length === 0;

  return {
    results,
    isLoading,
    isError,
    isEmpty: isEmpty && debouncedQuery.length >= 2,
  };
}

/**
 * Hook for searching leads only
 */
export function useSearchLeads(query: string, limit: number = 10) {
  const { data, isLoading } = useQuery({
    queryKey: SEARCH_KEYS.leads(query),
    queryFn: () => searchLeads(query, limit),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 2,
  });

  return {
    leads: data?.data || [],
    isLoading,
  };
}

/**
 * Hook for searching customers only
 */
export function useSearchCustomers(query: string, limit: number = 10) {
  const { data, isLoading } = useQuery({
    queryKey: SEARCH_KEYS.customers(query),
    queryFn: () => searchCustomers(query, limit),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 2,
  });

  return {
    customers: data?.data || [],
    isLoading,
  };
}

/**
 * Hook for debounced search input
 */
export function useDebouncedSearch(initialValue: string = '', delay: number = 300) {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  const clearSearch = useCallback(() => {
    setValue('');
    setDebouncedValue('');
  }, []);

  return {
    value,
    debouncedValue,
    setValue,
    clearSearch,
  };
}
