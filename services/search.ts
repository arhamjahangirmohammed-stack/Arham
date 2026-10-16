/**
 * Search Service
 *
 * Global search across leads and customers.
 */

import { supabase } from '@/lib/supabase/client';
import { Lead, Customer, ServiceResponse } from '@/lib/types';
import { getCurrentUserId, handleServiceError } from './base';

interface SearchResult {
  leads: Lead[];
  customers: Customer[];
}

/**
 * Global search across leads and customers
 * Searches name, company, and email fields
 */
export async function globalSearch(query: string): Promise<ServiceResponse<SearchResult>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  if (!query || query.trim().length < 2) {
    return { data: { leads: [], customers: [] }, error: null };
  }

  const searchTerm = `%${query.trim()}%`;

  try {
    // Run both searches in parallel
    const [leadsRes, customersRes] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.${searchTerm},company.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5),
      supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.${searchTerm},company.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5),
    ]);

    // Don't throw on individual errors - return empty arrays
    const leads = (leadsRes.data || []) as Lead[];
    const customers = (customersRes.data || []) as Customer[];

    return {
      data: { leads, customers },
      error: null,
    };
  } catch (error) {
    return handleServiceError(error, 'globalSearch');
  }
}

/**
 * Search only leads
 */
export async function searchLeads(query: string, limit: number = 10): Promise<ServiceResponse<Lead[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  if (!query || query.trim().length < 2) {
    return { data: [], error: null };
  }

  const searchTerm = `%${query.trim()}%`;

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.${searchTerm},company.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(limit);

    if (error) {
      return handleServiceError(error, 'searchLeads');
    }

    return { data: data as Lead[], error: null };
  } catch (error) {
    return handleServiceError(error, 'searchLeads');
  }
}

/**
 * Search only customers
 */
export async function searchCustomers(query: string, limit: number = 10): Promise<ServiceResponse<Customer[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  if (!query || query.trim().length < 2) {
    return { data: [], error: null };
  }

  const searchTerm = `%${query.trim()}%`;

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.${searchTerm},company.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(limit);

    if (error) {
      return handleServiceError(error, 'searchCustomers');
    }

    return { data: data as Customer[], error: null };
  } catch (error) {
    return handleServiceError(error, 'searchCustomers');
  }
}
