'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CommandHistoryItem, AICommandResult, AIIntent } from '@/lib/types';

interface AICommandContextType {
  isCommandBarOpen: boolean;
  isAIThinking: boolean;
  currentAIOperation: string | null;
  commandHistory: CommandHistoryItem[];
  lastResult: AICommandResult | null;
  openCommandBar: (prefill?: string) => void;
  closeCommandBar: () => void;
  setAIThinking: (thinking: boolean, operation?: string) => void;
  addToHistory: (item: CommandHistoryItem) => void;
  clearHistory: () => void;
  setLastResult: (result: AICommandResult | null) => void;
  prefillCommand: string;
}

const AICommandContext = createContext<AICommandContextType | null>(null);

const MAX_HISTORY_ITEMS = 20;
const STORAGE_KEY = 'nexus-ai-command-history';

export function AICommandProvider({ children }: { children: ReactNode }) {
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [currentAIOperation, setCurrentAIOperation] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [lastResult, setLastResult] = useState<AICommandResult | null>(null);
  const [prefillCommand, setPrefillCommand] = useState('');

  // Load command history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CommandHistoryItem[];
        if (Array.isArray(parsed)) {
          setCommandHistory(parsed.slice(0, MAX_HISTORY_ITEMS));
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  // Persist command history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(commandHistory));
    } catch {
      // Ignore storage errors
    }
  }, [commandHistory]);

  const openCommandBar = useCallback((prefill?: string) => {
    setPrefillCommand(prefill || '');
    setIsCommandBarOpen(true);
  }, []);

  const closeCommandBar = useCallback(() => {
    setIsCommandBarOpen(false);
    setPrefillCommand('');
  }, []);

  const setAIThinkingState = useCallback((thinking: boolean, operation?: string) => {
    setIsAIThinking(thinking);
    setCurrentAIOperation(thinking ? (operation || 'Processing...') : null);
  }, []);

  const addToHistory = useCallback((item: CommandHistoryItem) => {
    setCommandHistory((prev) => {
      const newHistory = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, MAX_HISTORY_ITEMS);
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setCommandHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: AICommandContextType = {
    isCommandBarOpen,
    isAIThinking,
    currentAIOperation,
    commandHistory,
    lastResult,
    openCommandBar,
    closeCommandBar,
    setAIThinking: setAIThinkingState,
    addToHistory,
    clearHistory,
    setLastResult,
    prefillCommand,
  };

  return <AICommandContext.Provider value={value}>{children}</AICommandContext.Provider>;
}

export function useAICommand(): AICommandContextType {
  const context = useContext(AICommandContext);
  if (!context) {
    throw new Error('useAICommand must be used within an AICommandProvider');
  }
  return context;
}

/**
 * Generate a unique ID for command history items
 */
export function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a command history item from an AI result
 */
export function createHistoryItem(command: string, result: AICommandResult, success: boolean): CommandHistoryItem {
  return {
    id: generateCommandId(),
    command,
    intent: result.intent,
    timestamp: new Date().toISOString(),
    success,
  };
}
