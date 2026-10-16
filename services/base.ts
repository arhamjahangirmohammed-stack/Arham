/**
 * Base Service Utilities
 *
 * Shared utilities for all service functions.
 * All services should use these helpers for consistent error handling and user filtering.
 */

import { supabase } from '@/lib/supabase/client';
import { ServiceResponse, PaginationParams } from '@/lib/types';

/**
 * Get the current authenticated user's ID
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Handle any error and return a consistent ServiceResponse
 */
export function handleServiceError(error: unknown, context: string): ServiceResponse<never> {
  let message = 'An unexpected error occurred';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  }

  // Strip sensitive information from error messages
  message = message.replace(/api[_-]?key/gi, '[REDACTED]');
  message = message.replace(/password/gi, '[REDACTED]');
  message = message.replace(/token/gi, '[REDACTED]');

  console.error(`[${context}]`, error);

  return {
    data: null,
    error: message,
  };
}

/**
 * Build Supabase range() parameters from pagination params
 */
export function buildPaginationRange(page: number = 1, pageSize: number = 25): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

/**
 * Convert an array of objects to CSV format
 */
export function arrayToCSV<T>(data: T[], headers: (keyof T)[]): string {
  const headerRow = String(headers.join(','));

  const rows = data.map((item) => {
    return headers
      .map((header) => {
        const value = item[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(',');
  });

  return [headerRow, ...rows].join('\n');
}

/**
 * Apply user filter to a Supabase query
 * Returns the modified query builder
 */
export function withUserFilter<T>(
  query: {
    eq: (column: string, value: string) => T;
  },
  userId: string
): T {
  return query.eq('user_id', userId);
}

/**
 * Calculate total pages from total count and page size
 */
export function calculateTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

/**
 * Check if there are more pages available
 */
export function hasMorePages(currentPage: number, totalPages: number): boolean {
  return currentPage < totalPages;
}

/**
 * Format a date for display in timelines
 */
export function formatDateForTimeline(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)} weeks ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Generate a unique ID for new records
 */
export function generateId(): string {
  return crypto.randomUUID();
}
