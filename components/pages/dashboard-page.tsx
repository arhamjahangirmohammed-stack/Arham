'use client';

import { useMemo, useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useAICommand } from '@/lib/ai-command-context';
import { useLeads, useDealsAtRisk } from '@/hooks/useLeads';
import { useCustomers } from '@/hooks/useCustomers';
import { useTasks, useOverdueTasks, useTodaysTasks, useCompleteTask } from '@/hooks/useTasks';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Users, Target, TrendingUp, Flame, CheckCircle2,
  DollarSign, AlertTriangle, CheckSquare,
  Sparkles, ChevronRight, ArrowRight,
  AlertCircle, Trophy, BarChart3, Eye, Calendar,
  Activity as ActivityIcon, StickyNote, Mail, Phone,
  Zap, Plus, Clock,
  CheckCheck, Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Lead, Customer, Task, Activity, Profile } from '@/lib/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatRelative(dateString: string | null | undefined): string {
  if (!dateString) return 'Never contacted';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatExactDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function getAvatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-violet-500 to-purple-500',
    'from-sky-500 to-blue-500',
    'from-green-500 to-emerald-500',
  ];
  const idx = name.charCodeAt(0) % gradients.length;
  return gradients[idx];
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Strong';
  if (score >= 30) return 'Fair';
  return 'Needs Attention';
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 30) return '#f59e0b';
  return '#ef4444';
}

// ─── Activity config ─────────────────────────────────────────────────────────

const activityConfig: Record<string, { icon: typeof ActivityIcon; label: string }> = {
  note_added:           { icon: StickyNote,    label: 'Note added' },
  lead_created:         { icon: Target,        label: 'Lead created' },
  lead_updated:         { icon: Target,        label: 'Lead updated' },
  lead_status_changed:  { icon: TrendingUp,    label: 'Status changed' },
  customer_created:     { icon: Users,         label: 'Customer created' },
  customer_updated:     { icon: Users,         label: 'Customer updated' },
  interaction_logged:   { icon: Phone,         label: 'Interaction logged' },
  task_created:         { icon: CheckSquare,   label: 'Task created' },
  task_completed:       { icon: CheckCheck,    label: 'Task completed' },
  task_assigned:        { icon: CheckSquare,   label: 'Task assigned' },
  follow_up_scheduled:  { icon: Calendar,      label: 'Follow-up scheduled' },
  follow_up_completed:  { icon: CheckCircle2,  label: 'Follow-up completed' },
  email_sent:           { icon: Mail,          label: 'Email sent' },
  email_generated:      { icon: Mail,          label: 'Email drafted' },
  meeting_scheduled:    { icon: Calendar,      label: 'Meeting scheduled' },
  score_updated:        { icon: TrendingUp,    label: 'Score updated' },
  ai_query:             { icon: Sparkles,      label: 'AI query' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SkeletonCard = memo(function SkeletonCard() {
  return (
    <Card className="rounded-xl border-border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <Skeleton className="h-8 w-24 mb-1 rounded" />
        <Skeleton className="h-3 w-32 rounded" />
        <div className="mt-4 pt-3 border-t border-border">
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      </CardContent>
    </Card>
  );
});

interface KpiCardProps {
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  displayValue: string;
  trend?: { label: string; positive: boolean } | null;
  insight: string;
  href?: string;
  attention?: boolean;
  index: number;
}

const KpiCard = memo(function KpiCard({
  icon: Icon, iconBg, iconColor, label,
  value, displayValue, trend, insight, href, attention, index,
}: KpiCardProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 750;
    let raf: number;
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  // Format using the same logic but with animated count
  const animatedDisplay = useMemo(() => {
    if (displayValue.startsWith('$')) {
      return formatCurrency(count);
    }
    return count.toLocaleString();
  }, [count, displayValue]);

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="group h-full"
    >
      <Card className={cn(
        'h-full rounded-xl border-border bg-card shadow-sm transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        attention && 'border-amber-300 dark:border-amber-700',
      )}>
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between mb-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
            {attention && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-2.5 w-2.5" />
                Attention
              </span>
            )}
          </div>

          <div className="flex-1">
            <p className="text-2xl font-bold font-mono tracking-tight tabular-nums">
              {animatedDisplay}
            </p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border space-y-1">
            {trend && (
              <p className={cn(
                'text-xs font-medium flex items-center gap-1',
                trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}>
                <TrendingUp className={cn('h-3 w-3', !trend.positive && 'rotate-180')} />
                {trend.label}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground leading-tight">{insight}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return href ? <Link href={href} className="block h-full">{card}</Link> : card;
});

interface ScoreRingProps {
  score: number;
  size?: number;
}

const ScoreRing = memo(function ScoreRing({ score, size = 40 }: ScoreRingProps) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const [dashOffset, setDashOffset] = useState(circ);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDashOffset(circ - (score / 100) * circ);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circ]);

  const color = scoreColor(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3}
          className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3}
          stroke={color} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
        style={{ color }}>
        {score}
      </span>
    </div>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

export function DashboardPage() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { openCommandBar } = useAICommand();
  const { mutate: completeTask } = useCompleteTask();

  const { data: leadsData, isLoading: leadsLoading } = useLeads();
  const { data: customersData, isLoading: customersLoading } = useCustomers();
  const { data: tasksData } = useTasks();
  const { data: overdueTasks } = useOverdueTasks();
  const { data: todaysTasks } = useTodaysTasks();
  const { data: dealsAtRisk } = useDealsAtRisk();

  const leads = useMemo(() => (leadsData?.data || []) as Lead[], [leadsData]);
  const customers = useMemo(() => (customersData?.data || []) as Customer[], [customersData]);
  const tasks = useMemo(() => (tasksData?.data || []) as Task[], [tasksData]);

  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.user?.id) return;
    setLoadingActivities(true);
    Promise.all([
      supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('profiles').select('*'),
    ]).then(([actRes, profilesRes]) => {
      setRecentActivities((actRes.data || []) as Activity[]);
      setProfiles((profilesRes.data || []) as Profile[]);
      setLoadingActivities(false);
    });
  }, [session]);

  const stats = useMemo(() => {
    const hotLeads = leads.filter(l => l.temperature === 'hot' && !['won', 'lost'].includes(l.status));
    const activeLeads = leads.filter(l => !['won', 'lost'].includes(l.status));
    const activeCustomers = customers.filter(c => c.status === 'active');
    const pipelineValue = activeLeads.reduce((s, l) => s + (l.estimated_value || 0), 0);
    const topLead = [...hotLeads].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const overdueCount = overdueTasks?.data?.length || 0;
    const todayCount = todaysTasks?.data?.length || 0;
    const atRiskCount = dealsAtRisk?.data?.length || 0;
    const tasksDoneToday = tasks.filter(t =>
      t.status === 'completed' && t.completed_at &&
      new Date(t.completed_at).toDateString() === new Date().toDateString()
    ).length;
    return {
      hotLeads: hotLeads.length,
      activeLeads: activeLeads.length,
      pipelineValue,
      activeCustomers: activeCustomers.length,
      topLead,
      overdueCount,
      todayCount,
      atRiskCount,
      tasksDoneToday,
    };
  }, [leads, customers, overdueTasks, todaysTasks, dealsAtRisk, tasks]);

  // Pipeline bar chart data
  const pipelineChartData = useMemo(() => {
    const stages: { name: string; count: number; value: number; fill: string }[] = [
      { name: 'New',       count: 0, value: 0, fill: '#94a3b8' },
      { name: 'Contacted', count: 0, value: 0, fill: '#60a5fa' },
      { name: 'Qualified', count: 0, value: 0, fill: '#34d399' },
      { name: 'Proposal',  count: 0, value: 0, fill: '#818cf8' },
      { name: 'Won',       count: 0, value: 0, fill: '#22c55e' },
    ];
    const map: Record<string, number> = { new: 0, contacted: 1, qualified: 2, proposal: 3, won: 4 };
    leads.forEach(l => {
      const idx = map[l.status];
      if (idx !== undefined) {
        stages[idx].count += 1;
        stages[idx].value += l.estimated_value || 0;
      }
    });
    return stages;
  }, [leads]);

  const totalPipelineLeads = pipelineChartData.reduce((s, d) => s + d.count, 0);

  // Top 5 leads by score
  const topLeads = useMemo(() =>
    [...leads]
      .filter(l => !['won', 'lost'].includes(l.status))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5),
  [leads]);

  // Recent customers (3 most recent)
  const recentCustomers = useMemo(() =>
    [...customers]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3),
  [customers]);

  // Needs attention: overdue tasks + at-risk deals + hot leads not contacted 7+ days
  const needsAttention = useMemo(() => {
    const items: Array<{
      id: string;
      priority: number;
      icon: typeof ActivityIcon;
      iconBg: string;
      iconColor: string;
      title: string;
      description: string;
      urgency: string;
      urgencyColor: string;
      href: string;
      action: string;
    }> = [];

    (overdueTasks?.data || []).slice(0, 3).forEach((t: Task) => {
      items.push({
        id: `task-${t.id}`,
        priority: 1,
        icon: AlertCircle,
        iconBg: 'bg-rose-100 dark:bg-rose-900/40',
        iconColor: 'text-rose-600 dark:text-rose-400',
        title: t.title,
        description: `Task · ${t.priority} priority`,
        urgency: 'Overdue',
        urgencyColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        href: '/tasks',
        action: 'View',
      });
    });

    (dealsAtRisk?.data || []).slice(0, 3).forEach((l: Lead) => {
      items.push({
        id: `risk-${l.id}`,
        priority: 2,
        icon: AlertTriangle,
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        iconColor: 'text-amber-600 dark:text-amber-400',
        title: l.name,
        description: `${l.company || 'No company'} · Score ${l.score ?? 0}`,
        urgency: 'At risk',
        urgencyColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        href: `/leads/${l.id}`,
        action: 'Open',
      });
    });

    leads.filter(l =>
      l.temperature === 'hot' &&
      !['won', 'lost'].includes(l.status) &&
      l.last_contacted_at &&
      (Date.now() - new Date(l.last_contacted_at).getTime()) > 7 * 86_400_000
    ).slice(0, 2).forEach(l => {
      items.push({
        id: `hot-${l.id}`,
        priority: 3,
        icon: Flame,
        iconBg: 'bg-orange-100 dark:bg-orange-900/40',
        iconColor: 'text-orange-600 dark:text-orange-400',
        title: l.name,
        description: `Hot lead · Last contact ${formatRelative(l.last_contacted_at)}`,
        urgency: 'Follow up',
        urgencyColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        href: `/leads/${l.id}`,
        action: 'Open',
      });
    });

    return items.sort((a, b) => a.priority - b.priority).slice(0, 6);
  }, [overdueTasks, dealsAtRisk, leads]);

  // AI-style insights derived from data
  const aiInsights = useMemo(() => {
    const all: Array<{
      id: string;
      category: 'Risk' | 'Opportunity' | 'Trend' | 'Recommendation' | 'Summary';
      accentColor: string;
      title: string;
      description: string;
      action: string;
      href: string;
    }> = [];

    if (stats.atRiskCount > 0) {
      all.push({
        id: 'risk-1',
        category: 'Risk',
        accentColor: 'border-rose-500',
        title: `${stats.atRiskCount} deal${stats.atRiskCount > 1 ? 's' : ''} need immediate attention`,
        description: `These opportunities haven't been contacted recently and may go cold. Reach out today to keep them warm.`,
        action: 'Review',
        href: '/leads',
      });
    }

    if (stats.hotLeads > 0 && stats.topLead) {
      all.push({
        id: 'opp-1',
        category: 'Opportunity',
        accentColor: 'border-emerald-500',
        title: `${stats.hotLeads} hot lead${stats.hotLeads > 1 ? 's' : ''} ready to close`,
        description: `${stats.topLead.name}${stats.topLead.company ? ` at ${stats.topLead.company}` : ''} is your top-scoring lead with a score of ${stats.topLead.score ?? 0}. Consider a proposal.`,
        action: 'Open Lead',
        href: `/leads/${stats.topLead.id}`,
      });
    }

    if (stats.pipelineValue > 0) {
      all.push({
        id: 'trend-1',
        category: 'Trend',
        accentColor: 'border-blue-500',
        title: `Active pipeline stands at ${formatCurrency(stats.pipelineValue)}`,
        description: `You have ${stats.activeLeads} active leads across your pipeline. Qualified and Proposal stages drive the most value.`,
        action: 'View Pipeline',
        href: '/leads',
      });
    }

    if (stats.overdueCount > 0) {
      all.push({
        id: 'rec-1',
        category: 'Recommendation',
        accentColor: 'border-amber-500',
        title: `Clear ${stats.overdueCount} overdue task${stats.overdueCount > 1 ? 's' : ''} today`,
        description: `Overdue tasks reduce response rates and signal low engagement to prospects. Block 30 minutes to work through them.`,
        action: 'View Tasks',
        href: '/tasks',
      });
    }

    if (stats.activeCustomers > 0) {
      all.push({
        id: 'sum-1',
        category: 'Summary',
        accentColor: 'border-sky-500',
        title: `${stats.activeCustomers} active customer${stats.activeCustomers > 1 ? 's' : ''} in your portfolio`,
        description: `Your customer base is healthy. Regular check-ins and expansion conversations can increase lifetime value.`,
        action: 'View Customers',
        href: '/customers',
      });
    }

    // Ensure at least 4 insights
    if (all.length < 4) {
      all.push({
        id: 'gen-1',
        category: 'Recommendation',
        accentColor: 'border-violet-500',
        title: 'Schedule weekly pipeline reviews',
        description: 'A consistent cadence of pipeline reviews helps catch stalled deals early and accelerates decision cycles.',
        action: 'Ask AI',
        href: '#',
      });
    }
    if (all.length < 4) {
      all.push({
        id: 'gen-2',
        category: 'Opportunity',
        accentColor: 'border-teal-500',
        title: 'Use AI to draft your follow-up emails',
        description: 'Personalised follow-ups sent within 24 hours of last contact increase reply rates by up to 40%.',
        action: 'Open AI',
        href: '/ai-chat',
      });
    }

    return all.filter(i => !Array.from(dismissedInsights).includes(i.id));
  }, [stats, leads, dismissedInsights]);

  const getUserName = useCallback((userId: string) => {
    const p = profiles.find(p => p.user_id === userId);
    return p?.full_name || 'Team';
  }, [profiles]);

  const handleCompleteTask = useCallback((taskId: string) => {
    setCompletingTask(taskId);
    setCompletedTasks(prev => { const next = new Set(prev); next.add(taskId); return next; });
    setTimeout(() => {
      completeTask(taskId);
      setCompletingTask(null);
    }, 400);
  }, [completeTask]);

  // AI briefing lines derived from data
  const briefingLines = useMemo(() => {
    const lines: string[] = [];
    if (stats.overdueCount > 0) lines.push(`You have ${stats.overdueCount} overdue task${stats.overdueCount > 1 ? 's' : ''} requiring attention.`);
    if (stats.hotLeads > 0) lines.push(`${stats.hotLeads} hot lead${stats.hotLeads > 1 ? 's are' : ' is'} active and ready to engage.`);
    if (stats.atRiskCount > 0) lines.push(`${stats.atRiskCount} deal${stats.atRiskCount > 1 ? 's are' : ' is'} at risk — consider reaching out today.`);
    if (stats.pipelineValue > 0) lines.push(`Your active pipeline is valued at ${formatCurrency(stats.pipelineValue)}.`);
    if (stats.todayCount > 0) lines.push(`${stats.todayCount} task${stats.todayCount > 1 ? 's are' : ' is'} scheduled for today.`);
    if (lines.length === 0) lines.push('Your pipeline is clean and up to date. Great work!');
    return lines;
  }, [stats]);

  const isLoading = leadsLoading || customersLoading;
  const hasNoData = !isLoading && leads.length === 0 && customers.length === 0;

  const firstName = profile?.full_name?.split(' ')[0] || null;

  if (!session) return null;

  // ── Empty onboarding state ──────────────────────────────────────────────────
  if (hasNoData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/20">
          <BarChart3 className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome to Nexus CRM</h2>
          <p className="mt-2 text-muted-foreground max-w-sm">
            Your dashboard is ready. Add your first lead or import contacts to start seeing insights here.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button onClick={() => router.push('/leads')} className="gap-2">
            <Plus className="h-4 w-4" /> Create your first lead
          </Button>
          <Button variant="outline" onClick={() => router.push('/customers')} className="gap-2">
            <Users className="h-4 w-4" /> Import contacts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 pb-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your business at a glance.</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-0.5">
            <p className="text-sm font-medium">
              {getGreeting()}{firstName ? `, ${firstName}` : ''}.
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-[11px] text-muted-foreground/60">Updated just now</p>
          </div>
        </div>

        {/* ── AI Daily Briefing ────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="rounded-xl border-l-4 border-l-sky-500 border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">AI Daily Briefing</p>
                      <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> Updated just now
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                      {getGreeting()}{firstName ? `, ${firstName}` : ''}. {briefingLines.join(' ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick action chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { label: 'Review priorities', href: '/tasks' },
                  { label: 'Open pipeline', href: '/leads' },
                  { label: 'Draft follow-ups', href: '/follow-ups' },
                  { label: 'Catch me up', action: openCommandBar },
                ].map(chip => (
                  chip.action ? (
                    <button
                      key={chip.label}
                      onClick={() => chip.action!()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted cursor-pointer"
                    >
                      {chip.label} <ChevronRight className="h-3 w-3" />
                    </button>
                  ) : (
                    <Link key={chip.label} href={chip.href!}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted cursor-pointer">
                        {chip.label} <ChevronRight className="h-3 w-3" />
                      </span>
                    </Link>
                  )
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              index={0}
              icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
              iconColor="text-emerald-600 dark:text-emerald-400"
              label="Pipeline Value"
              value={stats.pipelineValue}
              displayValue={formatCurrency(stats.pipelineValue)}
              trend={stats.activeLeads > 0 ? { label: `${stats.activeLeads} active opportunities`, positive: true } : null}
              insight={stats.pipelineValue > 0 ? 'Excludes won and lost deals.' : 'No active pipeline yet.'}
              href="/leads"
            />
            <KpiCard
              index={1}
              icon={Flame}
              iconBg="bg-orange-100 dark:bg-orange-900/40"
              iconColor="text-orange-600 dark:text-orange-400"
              label="Hot Leads"
              value={stats.hotLeads}
              displayValue={String(stats.hotLeads)}
              trend={stats.topLead ? { label: `Top: ${stats.topLead.name.split(' ')[0]}`, positive: true } : null}
              insight={stats.hotLeads > 0 ? 'Prioritise outreach within 48h.' : 'No hot leads at the moment.'}
              href="/leads"
            />
            <KpiCard
              index={2}
              icon={CheckSquare}
              iconBg="bg-blue-100 dark:bg-blue-900/40"
              iconColor="text-blue-600 dark:text-blue-400"
              label="Tasks Today"
              value={stats.todayCount}
              displayValue={String(stats.todayCount)}
              trend={stats.tasksDoneToday > 0 ? { label: `${stats.tasksDoneToday} completed today`, positive: true } : null}
              insight={stats.overdueCount > 0 ? `${stats.overdueCount} task${stats.overdueCount > 1 ? 's' : ''} overdue.` : 'No overdue tasks.'}
              href="/tasks"
              attention={stats.overdueCount > 0}
            />
            <KpiCard
              index={3}
              icon={stats.atRiskCount > 0 ? AlertTriangle : Trophy}
              iconBg={stats.atRiskCount > 0 ? 'bg-rose-100 dark:bg-rose-900/40' : 'bg-sky-100 dark:bg-sky-900/40'}
              iconColor={stats.atRiskCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}
              label="Deals at Risk"
              value={stats.atRiskCount}
              displayValue={String(stats.atRiskCount)}
              trend={null}
              insight={stats.atRiskCount > 0
                ? "These haven't been contacted recently."
                : 'No deals currently at risk.'}
              href="/leads"
              attention={stats.atRiskCount > 0}
            />
          </div>
        )}

        {/* ── Main Grid: 2/3 + 1/3 ─────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT COLUMN (2/3) */}
          <div className="space-y-6 lg:col-span-2">

            {/* Pipeline Overview */}
            <Card className="rounded-xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Pipeline Overview
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{leads.length} leads across all stages</p>
                </div>
                <Link href="/leads">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {isLoading ? (
                  <Skeleton className="h-52 w-full rounded-lg" />
                ) : leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-44 text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No pipeline data yet.</p>
                    <Button size="sm" className="mt-3 gap-1" onClick={() => router.push('/leads')}>
                      <Plus className="h-3.5 w-3.5" /> Add Lead
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pipelineChartData} barSize={32} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <RechartsTooltip
                            cursor={{ fill: 'currentColor', opacity: 0.04 }}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                            formatter={(value: number, name: string, props) => {
                              const d = props.payload;
                              const pct = totalPipelineLeads > 0 ? Math.round((d.count / totalPipelineLeads) * 100) : 0;
                              return [`${d.count} leads · ${formatCurrency(d.value)} · ${pct}%`, d.name];
                            }}
                            labelFormatter={() => ''}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {pipelineChartData.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Summary row */}
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {pipelineChartData.filter(d => d.count > 0).slice(0, 4).map(d => (
                        <div key={d.name} className="rounded-lg bg-muted/40 px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{d.name}</span>
                          </div>
                          <p className="text-sm font-bold">{d.count}</p>
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(d.value)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Needs Attention */}
            <Card className="rounded-xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Needs Attention
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Sorted by urgency</p>
                </div>
                {needsAttention.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0">
                    {needsAttention.length}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {needsAttention.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 mb-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold">Everything looks great.</p>
                    <p className="text-xs text-muted-foreground mt-1">You're caught up across your pipeline.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {needsAttention.map(item => (
                      <Link key={item.id} href={item.href}>
                        <div className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/50 cursor-pointer">
                          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', item.iconBg)}>
                            <item.icon className={cn('h-4 w-4', item.iconColor)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', item.urgencyColor)}>
                              {item.urgency}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Leads */}
            <Card className="rounded-xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Top Leads
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">By lead score · active only</p>
                </div>
                <Link href="/leads">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                  </div>
                ) : topLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Target className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No leads yet.</p>
                    <Button size="sm" className="mt-3 gap-1" onClick={() => router.push('/leads')}>
                      <Plus className="h-3.5 w-3.5" /> Create Lead
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {topLeads.map((lead, i) => {
                      const isStale = lead.last_contacted_at &&
                        (Date.now() - new Date(lead.last_contacted_at).getTime()) > 14 * 86_400_000;
                      return (
                        <motion.div key={lead.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                          <Link href={`/leads/${lead.id}`}>
                            <div className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/50">
                              <span className="text-xs font-bold text-muted-foreground/50 w-4 text-center">{i + 1}</span>
                              <div className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br',
                                getAvatarGradient(lead.name),
                              )}>
                                {getInitials(lead.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium">{lead.name}</p>
                                  <Badge variant="outline" className={cn(
                                    'text-[9px] px-1.5 py-0 h-4 shrink-0',
                                    lead.temperature === 'hot' && 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                                    lead.temperature === 'warm' && 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                                    lead.temperature === 'cold' && 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                                  )}>
                                    {lead.temperature}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {lead.company || 'No company'}
                                  {lead.last_contacted_at && (
                                    <span className={cn('ml-2', isStale && 'text-amber-600 dark:text-amber-400')}>
                                      · {formatRelative(lead.last_contacted_at)}
                                    </span>
                                  )}
                                  {!lead.last_contacted_at && (
                                    <span className="ml-2 text-rose-600 dark:text-rose-400">· Never contacted</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <ScoreRing score={lead.score ?? 0} size={38} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p className="text-xs font-medium">{scoreLabel(lead.score ?? 0)}</p>
                                    <p className="text-xs text-muted-foreground">Score: {lead.score ?? 0}/100</p>
                                  </TooltipContent>
                                </Tooltip>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN (1/3) */}
          <div className="space-y-6">

            {/* Today's Tasks */}
            <Card className="rounded-xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <CheckSquare className="h-4 w-4 text-blue-500" />
                    Today's Tasks
                  </CardTitle>
                  {stats.todayCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stats.tasksDoneToday} of {stats.todayCount} done
                    </p>
                  )}
                </div>
                <Link href="/tasks">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    All <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {(todaysTasks?.data || []).length === 0 && (overdueTasks?.data || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold">You're ahead today.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Nothing scheduled. Great time to plan ahead.</p>
                    <Button size="sm" variant="outline" className="mt-3 gap-1 text-xs" onClick={() => router.push('/tasks')}>
                      <Plus className="h-3 w-3" /> Create Task
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Show overdue first */}
                    {(overdueTasks?.data || []).slice(0, 2).map((task: Task) => (
                      <AnimatePresence key={task.id}>
                        {!completedTasks.has(task.id) && (
                          <motion.div
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-2.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 p-2.5"
                          >
                            <button
                              aria-label="Complete task"
                              onClick={() => handleCompleteTask(task.id)}
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-rose-400 transition-colors hover:bg-rose-100 dark:hover:bg-rose-800',
                                completingTask === task.id && 'bg-rose-400',
                              )}
                            >
                              {completingTask === task.id && <CheckCheck className="h-2.5 w-2.5 text-white" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{task.title}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 text-[9px] font-medium">
                              Overdue
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}
                    {(todaysTasks?.data || []).slice(0, 4).map((task: Task) => (
                      <AnimatePresence key={task.id}>
                        {!completedTasks.has(task.id) && (
                          <motion.div
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors"
                          >
                            <button
                              aria-label="Complete task"
                              onClick={() => handleCompleteTask(task.id)}
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                                task.priority === 'urgent' ? 'border-rose-400 hover:bg-rose-50' :
                                task.priority === 'high' ? 'border-orange-400 hover:bg-orange-50' :
                                'border-border hover:bg-muted',
                                completingTask === task.id && 'bg-emerald-400 border-emerald-400',
                              )}
                            >
                              {completingTask === task.id && <CheckCheck className="h-2.5 w-2.5 text-white" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{task.title}</p>
                            </div>
                            {task.priority === 'urgent' && (
                              <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 text-[9px] font-medium">urgent</span>
                            )}
                            {task.priority === 'high' && (
                              <span className="shrink-0 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 px-1.5 py-0.5 text-[9px] font-medium">high</span>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card className="rounded-xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Sparkles className="h-4 w-4 text-sky-500" />
                    AI Insights
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Derived from your pipeline</p>
                </div>
                <button
                  aria-label="Ask AI"
                  onClick={() => openCommandBar()}
                >
                  <Zap className="h-3 w-3" /> Ask AI
                </button>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {aiInsights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Sparkles className="h-6 w-6 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No insights available yet.</p>
                    <Button size="sm" variant="outline" className="mt-3 gap-1 text-xs" onClick={() => openCommandBar()}>
                      Run AI Analysis
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {aiInsights.map(insight => {
                        const categoryColors: Record<string, string> = {
                          Risk: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                          Opportunity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                          Trend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                          Recommendation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                          Summary: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
                        };
                        return (
                          <motion.div
                            key={insight.id}
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn('rounded-lg border-l-4 bg-muted/30 p-3', insight.accentColor)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', categoryColors[insight.category])}>
                                    {insight.category}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold leading-tight">{insight.title}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{insight.description}</p>
                              </div>
                              <button
                                aria-label="Dismiss insight"
                                onClick={() => setDismissedInsights(prev => { const next = new Set(prev); next.add(insight.id); return next; })}
                                className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors text-lg leading-none mt-0.5"
                              >
                                ×
                              </button>
                            </div>
                            <div className="mt-2">
                              {insight.href === '#' ? (
                                <button onClick={() => openCommandBar()} className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5">
                                  {insight.action} <ChevronRight className="h-3 w-3" />
                                </button>
                              ) : (
                                <Link href={insight.href} className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5">
                                  {insight.action} <ChevronRight className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="rounded-xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ActivityIcon className="h-4 w-4 text-blue-500" />
                  Recent Activity
                </CardTitle>
                <Link href="/activity">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    All <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {loadingActivities ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3 w-3/4 rounded" />
                          <Skeleton className="h-2.5 w-1/2 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Circle className="h-6 w-6 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No recent activity.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentActivities.map(activity => {
                      const cfg = activityConfig[activity.type] || activityConfig.note_added;
                      return (
                        <Tooltip key={activity.id}>
                          <TooltipTrigger asChild>
                            <div className="group flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50 cursor-default">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <cfg.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{activity.title}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatRelative(activity.created_at)} · {getUserName(activity.user_id)}
                                </p>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">
                            {formatExactDate(activity.created_at)}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    <Link href="/activity" className="block pt-1">
                      <p className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5 px-2">
                        View all activity <ChevronRight className="h-3 w-3" />
                      </p>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* ── Recent Customers (full width bottom) ────────────────────────── */}
        <Card className="rounded-xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-4 w-4 text-emerald-500" />
                Recent Customers
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Most recently added</p>
            </div>
            <Link href="/customers">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            {customersLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
              </div>
            ) : recentCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No customers yet.</p>
                <Button size="sm" className="mt-3 gap-1" onClick={() => router.push('/customers')}>
                  <Plus className="h-3.5 w-3.5" /> Add Customer
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentCustomers.map((customer, i) => {
                  const statusColors: Record<string, string> = {
                    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                    prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                    churned: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                    inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                  };
                  return (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group"
                    >
                      <Link href={`/customers/${customer.id}`}>
                        <div className="rounded-xl border border-border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-card h-full">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br',
                                getAvatarGradient(customer.name),
                              )}>
                                {getInitials(customer.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{customer.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{customer.company || 'No company'}</p>
                              </div>
                            </div>
                            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', statusColors[customer.status] || statusColors.inactive)}>
                              {customer.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-base font-bold font-mono">{formatCurrency(customer.value || 0)}</p>
                              <p className="text-[10px] text-muted-foreground">Added {formatRelative(customer.created_at)}</p>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </TooltipProvider>
  );
}
