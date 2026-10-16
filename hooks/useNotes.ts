/**
 * React Query hooks for note operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotesByEntity, createNote, deleteNote } from '@/services/notes';
import { Note, EntityType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type { Note };

// Query keys
export const NOTE_KEYS = {
  all: ['notes'] as const,
  byEntity: (entityType: string, entityId: string) => [...NOTE_KEYS.all, entityType, entityId] as const,
};

/**
 * Hook to fetch notes for an entity
 */
export function useNotesByEntity(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: NOTE_KEYS.byEntity(entityType, entityId),
    queryFn: () => getNotesByEntity(entityType, entityId),
    enabled: !!entityId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to create a note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { entity_type: EntityType; entity_id: string; content: string }) =>
      createNote(data.entity_type, data.entity_id, data.content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: NOTE_KEYS.byEntity(variables.entity_type, variables.entity_id) });
      toast({ title: 'Note added', description: 'Note has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to add note', variant: 'destructive' });
    },
  });
}

/**
 * Hook to delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id }: { id: string; entityType: EntityType; entityId: string }) => deleteNote(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: NOTE_KEYS.byEntity(variables.entityType, variables.entityId) });
      toast({ title: 'Note deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete note', variant: 'destructive' });
    },
  });
}
