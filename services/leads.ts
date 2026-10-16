/**
 * Lead Service
 *
 * Data access layer for lead operations.
 * All functions return ServiceResponse and never throw.
 */

import { supabase } from '@/lib/supabase/client';
import {
  Lead,
  Interaction,
  Note,
  ServiceResponse,
  PaginatedResponse,
  PaginationParams,
  SortParams,
  FilterParams,
  TimelineItem,
} from '@/lib/types';
import { getCurrentUserId, handleServiceError, buildPaginationRange, arrayToCSV } from './base';

/**
 * Get paginated list of leads
 */
export async function getLeads(
  params?: PaginationParams & SortParams & FilterParams
): Promise<PaginatedResponse<Lead>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated', pagination: { page: 1, pageSize: 25, total: 0, hasMore: false } };
  }

  try {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const { from, to } = buildPaginationRange(page, pageSize);

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order(params?.field || 'created_at', { ascending: params?.direction === 'asc' })
      .range(from, to);

    // Apply filters
    if (params?.status) {
      query = query.eq('status', params.status as string);
    }
    if (params?.temperature) {
      query = query.eq('temperature', params.temperature as string);
    }
    if (params?.industry) {
      query = query.eq('industry', params.industry as string);
    }

    const { data, error, count } = await query;

    if (error) {
      return handleServiceError(error, 'getLeads') as PaginatedResponse<Lead>;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: data as Lead[],
      error: null,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    return handleServiceError(error, 'getLeads') as PaginatedResponse<Lead>;
  }
}

/**
 * Get a single lead by ID
 */
export async function getLeadById(id: string): Promise<ServiceResponse<Lead>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).eq('user_id', userId).single();

    if (error) {
      return handleServiceError(error, 'getLeadById');
    }

    return { data: data as Lead, error: null };
  } catch (error) {
    return handleServiceError(error, 'getLeadById');
  }
}

/**
 * Create a new lead
 */
export async function createLead(leadData: Omit<Lead, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ServiceResponse<Lead>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...leadData, user_id: userId })
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'createLead');
    }

    return { data: data as Lead, error: null };
  } catch (error) {
    return handleServiceError(error, 'createLead');
  }
}

/**
 * Update an existing lead
 */
export async function updateLead(id: string, updates: Partial<Lead>): Promise<ServiceResponse<Lead>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'updateLead');
    }

    return { data: data as Lead, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateLead');
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('leads').delete().eq('id', id).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteLead');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteLead');
  }
}

/**
 * Delete multiple leads
 */
export async function deleteLeads(ids: string[]): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('leads').delete().in('id', ids).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteLeads');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteLeads');
  }
}

/**
 * Update status for multiple leads
 */
export async function updateLeadsStatus(ids: string[], status: Lead['status']): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase
      .from('leads')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'updateLeadsStatus');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateLeadsStatus');
  }
}

/**
 * Update temperature for multiple leads
 */
export async function updateLeadsTemperature(
  ids: string[],
  temperature: Lead['temperature']
): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase
      .from('leads')
      .update({ temperature, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'updateLeadsTemperature');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateLeadsTemperature');
  }
}

/**
 * Get lead timeline (interactions, notes, follow-ups, tasks)
 */
export async function getLeadTimeline(leadId: string): Promise<ServiceResponse<TimelineItem[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const [interactionsRes, notesRes, followUpsRes, tasksRes] = await Promise.all([
      supabase.from('interactions').select('*').eq('lead_id', leadId).eq('user_id', userId),
      supabase.from('notes').select('*').eq('entity_type', 'lead').eq('entity_id', leadId).eq('user_id', userId),
      supabase.from('follow_ups').select('*').eq('entity_type', 'lead').eq('entity_id', leadId).eq('user_id', userId),
      supabase.from('tasks').select('*').eq('entity_type', 'lead').eq('entity_id', leadId).eq('user_id', userId),
    ]);

    const timeline: TimelineItem[] = [];

    // Map interactions
    (interactionsRes.data || []).forEach((interaction) => {
      const int = interaction as Interaction;
      timeline.push({
        id: int.id,
        type: int.type === 'email' ? 'email' : int.type === 'meeting' ? 'meeting' : 'call',
        title: `${int.direction === 'inbound' ? 'Received' : 'Sent'} ${int.type}`,
        description: int.summary || int.subject,
        occurred_at: int.occurred_at,
        metadata: { direction: int.direction, replied: int.replied, meeting_booked: int.meeting_booked },
      });
    });

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
    return handleServiceError(error, 'getLeadTimeline');
  }
}

/**
 * Get leads that are at risk of being lost
 */
export async function getDealsAtRisk(): Promise<ServiceResponse<Lead[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    // Get leads in qualified/proposal stage with low score or no recent contact
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['qualified', 'proposal'])
      .or('score.lt.60,last_contacted_at.is.null')
      .order('score', { ascending: true });

    if (error) {
      return handleServiceError(error, 'getDealsAtRisk');
    }

    return { data: data as Lead[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getDealsAtRisk');
  }
}

/**
 * Get leads likely to close soon
 */
export async function getLeadsClosingSoon(): Promise<ServiceResponse<Lead[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'proposal')
      .gte('score', 65)
      .order('score', { ascending: false });

    if (error) {
      return handleServiceError(error, 'getLeadsClosingSoon');
    }

    return { data: data as Lead[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getLeadsClosingSoon');
  }
}

/**
 * Build a context string for AI analysis (pure function)
 */
export function getLeadContextString(lead: Lead, interactions: Interaction[], notes: Note[]): string {
  const parts: string[] = [];

  parts.push(`Lead: ${lead.name}`);
  if (lead.title) parts.push(`Title: ${lead.title}`);
  if (lead.company) parts.push(`Company: ${lead.company}`);
  if (lead.industry) parts.push(`Industry: ${lead.industry}`);
  parts.push(`Status: ${lead.status}`);
  parts.push(`Temperature: ${lead.temperature}`);
  parts.push(`Score: ${lead.score || 0}/100`);
  if (lead.estimated_value) parts.push(`Estimated Value: $${lead.estimated_value.toLocaleString()}`);

  const interactionCount = interactions.length;
  const lastContact = lead.last_contacted_at
    ? Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  parts.push(`Total Interactions: ${interactionCount}`);
  if (lastContact !== null) {
    parts.push(`Last Contact: ${lastContact} days ago`);
  }

  // Add recent note excerpts
  const recentNotes = notes.slice(0, 3);
  if (recentNotes.length > 0) {
    parts.push('\nRecent Notes:');
    recentNotes.forEach((note, i) => {
      const excerpt = note.content.length > 100 ? note.content.substring(0, 100) + '...' : note.content;
      parts.push(`  ${i + 1}. ${excerpt}`);
    });
  }

  return parts.join('\n');
}

/**
 * Export leads to CSV
 */
export async function exportLeadsCSV(filters?: FilterParams): Promise<ServiceResponse<string>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    let query = supabase.from('leads').select('*').eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status as string);
    }
    if (filters?.temperature) {
      query = query.eq('temperature', filters.temperature as string);
    }

    const { data, error } = await query;

    if (error) {
      return handleServiceError(error, 'exportLeadsCSV');
    }

    const csv = arrayToCSV(data as Lead[], [
      'name',
      'title',
      'company',
      'email',
      'phone',
      'industry',
      'status',
      'temperature',
      'score',
      'estimated_value',
      'created_at',
    ]);

    return { data: csv, error: null };
  } catch (error) {
    return handleServiceError(error, 'exportLeadsCSV');
  }
}

/**
 * Get interactions for a lead
 */
export async function getInteractionsByLeadId(leadId: string): Promise<ServiceResponse<Interaction[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', leadId)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false });

    if (error) {
      return handleServiceError(error, 'getInteractionsByLeadId');
    }

    return { data: data as Interaction[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getInteractionsByLeadId');
  }
}

/**
 * Create an interaction
 */
export async function createInteraction(
  interactionData: Omit<Interaction, 'id' | 'user_id' | 'created_at'>
): Promise<ServiceResponse<Interaction>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('interactions')
      .insert({ ...interactionData, user_id: userId })
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'createInteraction');
    }

    // Update lead's last_contacted_at
    await supabase
      .from('leads')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', interactionData.lead_id);

    return { data: data as Interaction, error: null };
  } catch (error) {
    return handleServiceError(error, 'createInteraction');
  }
}
