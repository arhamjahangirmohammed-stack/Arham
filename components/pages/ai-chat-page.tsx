'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lead, Interaction, ChatMessage } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { useLeads } from '@/hooks/useLeads';
import { useCreateTask } from '@/hooks/useTasks';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity';
import { createFollowUp } from '@/services/follow-ups';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Send, Trash2, Zap, Target, Users, CheckSquare,
  Calendar, Mail, Clock, AlertTriangle, ArrowRight, Copy, ExternalLink,
  Lightbulb, Bot, User as UserIcon, RefreshCw, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SourceRef = { type: string; name: string; id: string };
type AIAction = {
  type: 'create_task' | 'email_draft' | 'navigate';
  label: string;
  data?: Record<string, unknown>;
  href?: string;
};
type AIResponse = {
  response: string;
  sources?: SourceRef[];
  context?: { leadCount: number; customerCount: number; taskCount: number };
  aiPowered?: boolean;
};

type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AIAction;
  sources?: SourceRef[];
  aiPowered?: boolean;
  timestamp: string;
};

const QUICK_COMMANDS = [
  { icon: Target, label: 'Hot leads ready to close', command: 'Which leads are most likely to close this month?' },
  { icon: Clock, label: 'Overdue follow-ups', command: 'Which follow-ups are overdue?' },
  { icon: AlertTriangle, label: 'Deals at risk', command: 'Which deals are at risk of being lost?' },
  { icon: CheckSquare, label: 'Priority tasks', command: 'What should I prioritize today?' },
  { icon: Mail, label: 'Draft follow-ups', command: 'Draft follow-up emails for leads not contacted this week' },
  { icon: Users, label: 'Cold leads', command: 'Which leads have gone cold?' },
];

const ACTION_PATTERNS = [
  { pattern: /create task (.+)/i, action: 'create_task' },
  { pattern: /add task (.+)/i, action: 'create_task' },
  { pattern: /new task (.+)/i, action: 'create_task' },
  { pattern: /schedule follow.?up (?:for|with)? (.+)/i, action: 'schedule_follow_up' },
  { pattern: /email (.+?)(?: about (.+))?$/i, action: 'email_lead' },
  { pattern: /draft email (?:for|to) (.+)/i, action: 'email_lead' },
];

export function AIChatPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: leadsResponse } = useLeads();
  const leads = leadsResponse?.data || [];
  const createTask = useCreateTask();

  const loadHistory = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (data && data.length > 0) {
      const msgs = data as ChatMessage[];
      const displayMsgs: DisplayMessage[] = msgs.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        sources: (msg.sources as SourceRef[]) || undefined,
        aiPowered: msg.ai_powered,
        timestamp: msg.created_at,
      }));
      setMessages(displayMsgs);
      if (msgs[0]?.conversation_id) {
        setConversationId(msgs[0].conversation_id);
      }
    }
  }, [session]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parseActionCommand = (text: string): { action: string; params: string } | null => {
    for (const cmd of ACTION_PATTERNS) {
      const match = text.match(cmd.pattern);
      if (match) {
        return { action: cmd.action, params: match[1]?.trim() || '' };
      }
    }
    return null;
  };

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || loading || !session?.user?.id) return;

    setInput('');
    setLoading(true);

    const convId = conversationId || `conv-${Date.now()}`;
    if (!conversationId) setConversationId(convId);

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    await supabase.from('chat_messages').insert({
      role: 'user',
      content: text,
      conversation_id: convId,
    });

    try {
      const actionCmd = parseActionCommand(text);

      if (actionCmd) {
        const result = await handleActionCommand(actionCmd.action, actionCmd.params);

        const assistantMessage: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          action: result.action,
          aiPowered: true,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        await supabase.from('chat_messages').insert({
          role: 'assistant',
          content: result.response,
          conversation_id: convId,
          ai_powered: true,
        });
      } else {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-crm-assistant`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            message: text,
            conversationHistory: history,
            userId: session.user.id,
          }),
        });

        if (!response.ok) throw new Error(`Request failed (${response.status})`);

        const data: AIResponse = await response.json();
        const action = extractActionFromResponse(text, data);

        const assistantMessage: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          action,
          sources: data.sources,
          aiPowered: data.aiPowered,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        await supabase.from('chat_messages').insert({
          role: 'assistant',
          content: data.response,
          conversation_id: convId,
          sources: (data.sources || []) as unknown as Record<string, unknown>,
          ai_powered: data.aiPowered || false,
        });

        logActivity({
          type: 'ai_query',
          entity_type: 'none',
          title: `AI query: ${text.substring(0, 50)}`,
          description: data.aiPowered ? 'AI-powered response' : 'Fallback response',
          metadata: { query: text, ai_powered: data.aiPowered },
        });
      }
    } catch {
      const errorMessage: DisplayMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  const handleActionCommand = async (action: string, params: string): Promise<{ response: string; action?: AIAction }> => {
    switch (action) {
      case 'create_task': {
        const title = params;
        return new Promise((resolve) => {
          createTask.mutate(
            { title, status: 'pending', priority: 'medium' },
            {
              onSuccess: (result) => {
                const taskId = result.data?.id || '';
                logActivity({ type: 'task_created', entity_type: 'task', entity_id: taskId, title: `Task created: ${title}` });
                resolve({
                  response: `Done! I created the task "${title}". View it in your tasks list.`,
                  action: { type: 'navigate', label: 'View Tasks', href: '/tasks' }
                });
              },
              onError: () => {
                resolve({ response: `Failed to create task.` });
              }
            }
          );
        });
      }

      case 'schedule_follow_up': {
        const lead = leads.find((l: Lead) => l.name.toLowerCase().includes(params.toLowerCase()));
        if (!lead) return { response: `I couldn't find a lead matching "${params}". Try specifying their full name.` };

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const result = await createFollowUp('lead', lead.id, `Follow up with ${lead.name}`, tomorrow.toISOString());

        if (result.error) return { response: `Failed to schedule: ${result.error}` };

        logActivity({ type: 'follow_up_scheduled', entity_type: 'lead', entity_id: lead.id, title: `Follow-up scheduled for ${lead.name}` });

        return {
          response: `Scheduled a follow-up with ${lead.name} for tomorrow at 10:00 AM.`,
          action: { type: 'navigate', label: 'View Follow-ups', href: '/follow-ups' }
        };
      }

      case 'email_lead': {
        const leadName = params.split(' about ')[0];
        const lead = leads.find((l: Lead) => l.name.toLowerCase().includes(leadName.toLowerCase()));

        if (!lead) return { response: `I couldn't find a lead matching "${leadName}".` };

        const { data: interactions } = await supabase
          .from('interactions')
          .select('*')
          .eq('lead_id', lead.id)
          .order('occurred_at', { ascending: false })
          .limit(10);

        try {
          const emailRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-email-writer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ lead, interactions: interactions || [] }),
          });

          const emailData = await emailRes.json();

          if (emailData.error) {
            const email = generateFallbackEmail(lead, params);
            return {
              response: `Here's a draft for ${lead.name}:\n\n${email}`,
              action: { type: 'email_draft', label: 'Copy Email', data: { email } }
            };
          }

          return {
            response: `Here's a personalized email for ${lead.name}:\n\n${emailData.email}`,
            action: { type: 'email_draft', label: 'Copy Email', data: { email: emailData.email } }
          };
        } catch {
          const email = generateFallbackEmail(lead, params);
          return {
            response: `Here's a draft for ${lead.name}:\n\n${email}`,
            action: { type: 'email_draft', label: 'Copy Email', data: { email } }
          };
        }
      }

      default:
        return { response: `I'm not sure how to handle that command.` };
    }
  };

  const extractActionFromResponse = (query: string, response: AIResponse): AIAction | undefined => {
    const lower = query.toLowerCase();
    if (lower.includes('hot lead') || lower.includes('likely to close')) {
      return { type: 'navigate', label: 'View Hot Leads', href: '/leads' };
    }
    if (lower.includes('overdue') || lower.includes('follow')) {
      return { type: 'navigate', label: 'View Follow-ups', href: '/follow-ups' };
    }
    if (lower.includes('task') || lower.includes('priorit')) {
      return { type: 'navigate', label: 'View Tasks', href: '/tasks' };
    }
    if (response.sources && response.sources.length > 0) {
      return { type: 'navigate', label: 'View in CRM', href: '/leads' };
    }
    return undefined;
  };

  const handleClearChat = async () => {
    if (!conversationId) return;
    await supabase.from('chat_messages').delete().eq('conversation_id', conversationId);
    setMessages([]);
    setConversationId(null);
  };

  const handleExecuteAction = (action: AIAction) => {
    if (action.type === 'email_draft' && action.data?.email) {
      navigator.clipboard.writeText(action.data.email as string);
      return;
    }
    if (action.href) router.push(action.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:h-[calc(100vh-10rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/30">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Copilot</h1>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <p className="text-xs text-muted-foreground">Ready — ask anything or give commands</p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleClearChat}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden border-slate-200/80 shadow-lg">
        <ScrollArea ref={scrollRef} className="flex-1 p-4 lg:p-6">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <div className="mb-5 flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 shadow-inner">
                <Sparkles className="h-9 w-9 text-sky-600" />
              </div>
              <h2 className="text-lg font-semibold">Your AI Sales Copilot</h2>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                I answer questions, create tasks, draft emails, schedule follow-ups, and help you close deals.
              </p>

              <div className="mt-6 w-full max-w-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-sky-600" />
                  <span className="text-sm font-semibold">Quick Commands</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {QUICK_COMMANDS.map((cmd) => (
                    <button
                      key={cmd.label}
                      onClick={() => handleSend(cmd.command)}
                      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-all hover:border-sky-300 hover:bg-sky-50/50 hover:shadow-md"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-sky-100 group-hover:text-sky-600">
                        <cmd.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{cmd.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 p-4 text-left max-w-2xl w-full">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold">Try Action Commands:</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="cursor-pointer hover:text-foreground" onClick={() => setInput('Create task Call John about proposal')}>• "Create task Call John about proposal"</p>
                  <p className="cursor-pointer hover:text-foreground" onClick={() => setInput('Email Sarah at TechCorp')}>• "Email Sarah at TechCorp"</p>
                  <p className="cursor-pointer hover:text-foreground" onClick={() => setInput('Schedule follow-up for Acme Inc')}>• "Schedule follow-up for Acme Inc"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onActionClick={handleExecuteAction} />
              ))}
              {loading && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md">
                    <RefreshCw className="h-4 w-4 text-white animate-spin" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
                    <span className="text-sm text-slate-500">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-slate-200/80 bg-slate-50/50 p-4">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or give a command..."
                className="h-11 pr-12 bg-white border-slate-200 focus:border-sky-300"
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">
                  Enter
                </kbd>
              </div>
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-11 w-11 bg-gradient-to-r from-sky-500 to-blue-600 shadow-md shadow-blue-500/20"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Commands: "Create task...", "Email [name]", "Schedule follow-up for [name]"
          </p>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({
  message,
  onActionClick,
}: {
  message: DisplayMessage;
  onActionClick: (action: AIAction) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-3 animate-slide-up', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          isUser
            ? 'bg-slate-100'
            : 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-blue-500/20'
        )}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4 text-slate-600" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      <div className={cn('max-w-[75%] space-y-2', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-slate-900 text-white'
              : 'rounded-tl-sm bg-white border border-slate-200 text-slate-900 shadow-sm'
          )}
        >
          {message.content}
        </div>

        {!isUser && message.action && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => onActionClick(message.action!)}
          >
            {message.action.type === 'email_draft' ? (
              <>
                <Copy className="h-3 w-3" />
                {message.action.label}
              </>
            ) : (
              <>
                <ExternalLink className="h-3 w-3" />
                {message.action.label}
                <ChevronRight className="h-3 w-3" />
              </>
            )}
          </Button>
        )}

        {!isUser && (
          <div className="flex flex-wrap items-center gap-2">
            {message.aiPowered === true && (
              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 text-[10px]">
                <Sparkles className="mr-1 h-3 w-3" />
                AI-Powered
              </Badge>
            )}
            {message.aiPowered === false && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Fallback
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function generateFallbackEmail(lead: Lead, params?: string) {
  return `Subject: Following up — ${lead.company || 'our conversation'}

Hi ${lead.name},

I hope this email finds you well. I wanted to follow up on our previous conversation about ${lead.industry || 'your business'}.

Based on your interest, I'd love to schedule a brief call to discuss how we can help achieve your goals.

Are you available for a 15-minute call this week?

Best regards`;
}
