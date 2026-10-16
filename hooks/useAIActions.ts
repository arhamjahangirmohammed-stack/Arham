/**
 * React Query hooks for AI operations
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  qualifyLead,
  draftFollowUpEmail,
  detectDealsAtRisk,
  prioritizeDailyWork,
  generateSalesInsights,
  executeNaturalLanguageCommand,
} from '@/services/ai-actions';
import {
  Lead,
  Customer,
  Task,
  Interaction,
  Note,
  FollowUp,
  AICommandResult,
  AIInsight,
  LeadQualification,
  EmailDraft,
  DailyPriority,
  DealRisk,
  CommandHistoryItem,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAICommand } from '@/lib/ai-command-context';
import { createHistoryItem } from '@/lib/ai-command-context';

// Query keys
export const AI_KEYS = {
  all: ['ai'] as const,
  qualification: (leadId: string) => [...AI_KEYS.all, 'qualification', leadId] as const,
  risks: () => [...AI_KEYS.all, 'risks'] as const,
  priorities: () => [...AI_KEYS.all, 'priorities'] as const,
  insights: () => [...AI_KEYS.all, 'insights'] as const,
};

/**
 * Hook to use AI thinking state across all AI operations
 */
export function useAIThinking() {
  const { isAIThinking, currentAIOperation } = useAICommand();
  return { isAIThinking, currentAIOperation };
}

/**
 * Hook for lead qualification
 */
export function useQualifyLead() {
  const { toast } = useToast();
  const { setAIThinking, addToHistory } = useAICommand();

  return useMutation({
    mutationFn: ({ lead, interactions, notes }: { lead: Lead; interactions: Interaction[]; notes: Note[] }) =>
      qualifyLead(lead, interactions, notes),
    onMutate: () => {
      setAIThinking(true, 'Analyzing lead...');
    },
    onSuccess: (result, variables) => {
      setAIThinking(false);
      if (result.data) {
        toast({
          title: 'Lead qualified',
          description: `Score: ${result.data.score}/100 - ${result.data.recommendation}`,
        });
      }
    },
    onError: (error: Error) => {
      setAIThinking(false);
      toast({ title: 'AI Error', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Hook for drafting follow-up emails
 */
export function useDraftEmail() {
  const { toast } = useToast();
  const { setAIThinking } = useAICommand();

  return useMutation({
    mutationFn: ({
      lead,
      context,
      tone,
    }: {
      lead: Lead;
      context: string;
      tone?: 'formal' | 'friendly' | 'urgent' | 'follow-up';
    }) => draftFollowUpEmail(lead, context, tone),
    onMutate: () => {
      setAIThinking(true, 'Drafting email...');
    },
    onSuccess: (result) => {
      setAIThinking(false);
      if (result.data) {
        toast({ title: 'Email drafted', description: 'Review and copy your email below.' });
      }
    },
    onError: (error: Error) => {
      setAIThinking(false);
      toast({ title: 'AI Error', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Hook for detecting deals at risk
 */
export function useDetectRisks(leads: Lead[]) {
  const { setAIThinking } = useAICommand();

  return useQuery({
    queryKey: AI_KEYS.risks(),
    queryFn: async () => {
      setAIThinking(true, 'Analyzing pipeline...');
      const result = await detectDealsAtRisk(leads);
      setAIThinking(false);
      return result;
    },
    enabled: leads.length > 0,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook for daily prioritization
 */
export function usePrioritizeDay(tasks: Task[], leads: Lead[], followUps: FollowUp[]) {
  const { setAIThinking } = useAICommand();

  return useQuery({
    queryKey: AI_KEYS.priorities(),
    queryFn: async () => {
      setAIThinking(true, 'Planning your day...');
      const result = await prioritizeDailyWork(tasks, leads, followUps);
      setAIThinking(false);
      return result;
    },
    enabled: tasks.length > 0 || leads.length > 0,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Hook for generating sales insights
 */
export function useGenerateInsights(data: {
  customers: Customer[];
  leads: Lead[];
  recentTasks: Task[];
}) {
  const { setAIThinking } = useAICommand();

  return useQuery({
    queryKey: AI_KEYS.insights(),
    queryFn: async () => {
      setAIThinking(true, 'Generating insights...');
      const result = await generateSalesInsights(data);
      setAIThinking(false);
      return result;
    },
    enabled: data.leads.length > 0 || data.customers.length > 0,
    staleTime: 1000 * 60 * 15,
  });
}

/**
 * Hook for executing natural language commands
 */
export function useExecuteCommand() {
  const { toast } = useToast();
  const { setAIThinking, addToHistory, setLastResult } = useAICommand();

  return useMutation({
    mutationFn: ({
      command,
      context,
    }: {
      command: string;
      context: {
        leads: Lead[];
        customers: Customer[];
        tasks: Task[];
        currentPage: string;
        commandHistory: CommandHistoryItem[];
      };
    }) => executeNaturalLanguageCommand(command, context),
    onMutate: () => {
      setAIThinking(true, 'Processing command...');
    },
    onSuccess: (result, variables) => {
      setAIThinking(false);
      if (result.data) {
        setLastResult(result.data);
        addToHistory(createHistoryItem(variables.command, result.data, true));
      }
    },
    onError: (error: Error, variables) => {
      setAIThinking(false);
      addToHistory({
        id: `cmd_${Date.now()}`,
        command: variables.command,
        intent: 'general_answer',
        timestamp: new Date().toISOString(),
        success: false,
      });
      toast({ title: 'Command Error', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Hook for managing AI command result state
 */
export function useAIResult() {
  const { lastResult, setLastResult } = useAICommand();
  return { result: lastResult, clearResult: () => setLastResult(null) };
}

/**
 * Aggregate hook to check if any AI operation is in progress
 */
export function useIsAIProcessing() {
  const { isAIThinking } = useAICommand();
  return isAIThinking;
}
