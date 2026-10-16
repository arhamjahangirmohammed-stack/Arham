/**
 * Notes Service
 *
 * Data access layer for note operations.
 * All functions return ServiceResponse and never throw.
 */

import { supabase } from '@/lib/supabase/client';
import { Note, ServiceResponse, EntityType } from '@/lib/types';
import { getCurrentUserId, handleServiceError } from './base';

/**
 * Get all notes for a specific entity
 */
export async function getNotesByEntity(
  entityType: EntityType,
  entityId: string
): Promise<ServiceResponse<Note[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      return handleServiceError(error, 'getNotesByEntity');
    }

    return { data: data as Note[], error: null };
  } catch (error) {
    return handleServiceError(error, 'getNotesByEntity');
  }
}

/**
 * Create a new note
 */
export async function createNote(
  entityType: EntityType,
  entityId: string,
  content: string
): Promise<ServiceResponse<Note>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        content,
      })
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'createNote');
    }

    return { data: data as Note, error: null };
  } catch (error) {
    return handleServiceError(error, 'createNote');
  }
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);

    if (error) {
      return handleServiceError(error, 'deleteNote');
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'deleteNote');
  }
}

/**
 * Update a note
 */
export async function updateNote(id: string, content: string): Promise<ServiceResponse<Note>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return handleServiceError(error, 'updateNote');
    }

    return { data: data as Note, error: null };
  } catch (error) {
    return handleServiceError(error, 'updateNote');
  }
}
