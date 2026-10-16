'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAICommand } from '@/lib/ai-command-context';
import { useExecuteCommand } from '@/hooks/useAIActions';
import { useLeads } from '@/hooks/useLeads';
import { useCustomers } from '@/hooks/useCustomers';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, X, Copy, ExternalLink, ArrowRight, CheckCircle, AlertCircle, TrendingUp, Target, Lightbulb, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AICommandResult } from '@/lib/types';

const PLACEHOLDER_SUGGESTIONS = [
  "Show hot leads",
  "Deals at risk",
  "Draft follow-up to...",
  "Today's priorities",
  "Pipeline summary",
  "Overdue tasks",
];

const QUICK_COMMANDS = [
  { label: "Today's priorities", icon: Target, command: "What are my priorities for today?" },
  { label: "Deals at risk", icon: AlertCircle, command: "Which deals are at risk?" },
  { label: "Pipeline summary", icon: TrendingUp, command: "Give me a pipeline summary" },
  { label: "Hot leads", icon: Sparkles, command: "Show me hot leads" },
  { label: "Overdue tasks", icon: CheckCircle, command: "What tasks are overdue?" },
  { label: "Follow-ups", icon: Lightbulb, command: "Who needs a follow-up?" },
];

export function AICommandBar() {
  const router = useRouter();
  const { isCommandBarOpen, closeCommandBar, commandHistory, addToHistory, prefillCommand } = useAICommand();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<AICommandResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: leadsData } = useLeads();
  const { data: customersData } = useCustomers();
  const { data: tasksData } = useTasks();

  const executeCommand = useExecuteCommand();

  const leads = leadsData?.data || [];
  const customers = customersData?.data || [];
  const tasks = tasksData?.data || [];

  // Focus input and handle prefill
  useEffect(() => {
    if (isCommandBarOpen && textareaRef.current) {
      textareaRef.current.focus();
      if (prefillCommand) {
        setInput(prefillCommand);
      }
    }
  }, [isCommandBarOpen, prefillCommand]);

  // Clear result on close
  useEffect(() => {
    if (!isCommandBarOpen) {
      setResult(null);
      setInput('');
    }
  }, [isCommandBarOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeCommandBar();
      }
    };
    if (isCommandBarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCommandBarOpen, closeCommandBar]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCommandBar();
      }
    };
    if (isCommandBarOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isCommandBarOpen, closeCommandBar]);

  const handleSubmit = useCallback(async (command?: string) => {
    const query = command || input.trim();
    if (!query) return;

    setResult(null);

    const res = await executeCommand.mutateAsync({
      command: query,
      context: {
        leads,
        customers,
        tasks,
        currentPage: window.location.pathname,
        commandHistory: commandHistory.slice(0, 5),
      },
    });

    if (res.data) {
      const resultData = res.data;
      setResult(resultData);

      // Handle navigate intent
      if (resultData.intent === 'navigate' && resultData.navigateTo) {
        const navigateTo = resultData.navigateTo;
        setTimeout(() => {
          router.push(navigateTo);
          closeCommandBar();
        }, 800);
      }
    }
  }, [input, leads, customers, tasks, commandHistory, executeCommand, router, closeCommandBar]);

  const handleQuickCommand = (command: string) => {
    setInput(command);
    handleSubmit(command);
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copied to clipboard');
  };

  const renderResult = () => {
    if (!result) return null;

    switch (result.intent) {
      case 'navigate':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4"
          >
            <Card className="border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900">
                  <ArrowRight className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sky-700 dark:text-sky-300">{result.response}</p>
                  <p className="text-xs text-sky-600 dark:text-sky-400">Navigating...</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 'show_data':
      case 'detect_risk':
      case 'prioritize':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 space-y-3"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {result.response.split('\n').map((line, i) => (
                <p key={i} className="text-sm leading-relaxed">{line}</p>
              ))}
            </div>
            {result.actions && result.actions.length > 0 && (
              <div className="flex gap-2 pt-2">
                {result.actions.map((action, i) => (
                  <Button key={i} variant="outline" size="sm" className="gap-1.5">
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </motion.div>
        );

      case 'draft_email': {
        const emailBody = typeof result.data?.body === 'string' ? result.data.body : result.response;
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="gap-1.5">
                <Sparkles className="h-3 w-3" />
                AI Generated Email
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleCopyEmail(emailBody)}>
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
              </div>
            </div>
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap text-sm font-sans">{emailBody}</pre>
              </CardContent>
            </Card>
          </motion.div>
        );
      }

      case 'summarize':
      case 'show_insights':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 space-y-3"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {result.response.split('\n').map((line, i) => (
                <p key={i} className="text-sm leading-relaxed">{line}</p>
              ))}
            </div>
          </motion.div>
        );

      default:
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {result.response.split('\n').map((line, i) => (
                <p key={i} className="text-sm leading-relaxed">{line}</p>
              ))}
            </div>
          </motion.div>
        );
    }
  };

  if (!isCommandBarOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      >
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={closeCommandBar} />

        <motion.div
          ref={containerRef}
          initial={{ scale: 0.95, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -20 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl mx-4 bg-background rounded-2xl border border-border shadow-2xl shadow-black/30 overflow-hidden"
        >
          {/* Gradient top border */}
          <div className="h-[2px] bg-gradient-to-r from-sky-500 to-blue-600" />

          {/* Input zone */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask me anything... ('Show hot leads', 'Draft follow-up to Acme'...)"
                  rows={1}
                  className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>⌘↵ to send</span>
                  <span>ESC to close</span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleSubmit()}
                disabled={!input.trim() || executeCommand.isPending}
                className="bg-gradient-to-r from-sky-500 to-blue-600"
              >
                {executeCommand.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Thinking zone */}
          <AnimatePresence>
            {executeCommand.isPending && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">AI is thinking...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result zone */}
          <AnimatePresence>
            {result && !executeCommand.isPending && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border max-h-[50vh] overflow-y-auto"
              >
                {renderResult()}
                <div className="px-4 pb-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    <span>AI · Confidence: {Math.round(result.confidence * 100)}%</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setResult(null)}>
                    Ask follow-up
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick commands or command history (shown when no result) */}
          {!result && !executeCommand.isPending && (
            <div className="border-t border-border p-4 space-y-4">
              {/* Quick commands */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Quick commands</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_COMMANDS.map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickCommand(cmd.command)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <cmd.icon className="h-3 w-3" />
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Command history */}
              {commandHistory.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recent commands</p>
                  <div className="flex flex-wrap gap-2">
                    {commandHistory.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleQuickCommand(item.command)}
                        className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors truncate max-w-[200px]"
                      >
                        {item.command}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
