'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useDeleteTasks, useCompleteTask } from '@/hooks/useTasks';
import { useLeads } from '@/hooks/useLeads';
import { useCustomers } from '@/hooks/useCustomers';
import { Task, Lead, Customer, TaskStatus, TaskPriority } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Plus, Search, Pencil, Trash2, CheckCircle2, Circle, Clock, AlertTriangle,
  Calendar, Flag, User, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload,
  MoreHorizontal, Mail, Phone, ChevronRight, Sparkles, TrendingUp,
  CheckSquare, ListTodo, Target, RefreshCw, X, Zap, Eye, CalendarPlus,
  Copy, ExternalLink, Activity as ActivityIcon, FileText, MessageSquare,
  Edit, Send, ClipboardList, AlertCircle, Timer, Layers, Inbox,
  KanbanSquare, LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

type TaskForm = {
  title: string;
  description: string;
  entity_type: 'customer' | 'lead' | 'none';
  entity_id: string;
  assigned_to: string;
  priority: TaskPriority;
  due_date: string;
};

const emptyForm: TaskForm = {
  title: '',
  description: '',
  entity_type: 'none',
  entity_id: '',
  assigned_to: '',
  priority: 'medium',
  due_date: '',
};

// ─── Priority config ──────────────────────────────────────────────────────────

const priorityConfig: Record<TaskPriority, { color: string; badge: string; dot: string; icon: typeof Flag; label: string }> = {
  urgent: { color: 'text-red-600 dark:text-red-400', badge: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500', icon: AlertTriangle, label: 'Critical' },
  high: { color: 'text-orange-600 dark:text-orange-400', badge: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300', dot: 'bg-orange-500', icon: Flag, label: 'High' },
  medium: { color: 'text-blue-600 dark:text-blue-400', badge: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500', icon: Flag, label: 'Medium' },
  low: { color: 'text-slate-500 dark:text-slate-400', badge: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400', icon: Flag, label: 'Low' },
};

const statusConfig: Record<TaskStatus, { badge: string; label: string; icon: typeof Circle }> = {
  pending: { badge: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400', label: 'Todo', icon: Circle },
  in_progress: { badge: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300', label: 'In Progress', icon: Clock },
  completed: { badge: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'Completed', icon: CheckCircle2 },
  cancelled: { badge: 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500', label: 'Cancelled', icon: X },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return 'No due date';
  const now = new Date();
  const then = new Date(date);
  const diffMs = then.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  const absDays = Math.abs(diffDays);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays < 7) return `In ${absDays} days`;
  if (diffDays < 0 && diffDays > -7) return `${absDays}d overdue`;
  if (diffDays < 0) return `${Math.floor(absDays / 7)}w overdue`;
  if (diffDays < 30) return `In ${Math.floor(diffDays / 7)}w`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatExactDate(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatUpdated(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function isOverdueTask(task: Task): boolean {
  if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.due_date) < new Date();
}

function isDueToday(task: Task): boolean {
  if (!task.due_date) return false;
  const today = new Date().toISOString().split('T')[0];
  return task.due_date.startsWith(today);
}

function getProgress(task: Task): number {
  if (task.status === 'completed') return 100;
  if (task.status === 'cancelled') return 0;
  if (task.status === 'in_progress') return 50;
  return 0;
}

function getProgressLabel(task: Task): string {
  if (task.status === 'completed') return 'Completed';
  if (task.status === 'cancelled') return 'Cancelled';
  if (task.status === 'in_progress') return 'In Progress';
  return 'Not Started';
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
    'from-sky-500 to-blue-500',
    'from-green-500 to-emerald-500',
  ];
  return gradients[name.charCodeAt(0) % gradients.length];
}

function getTaskIndicator(task: Task): { label: string; color: string } | null {
  if (task.status === 'cancelled') return { label: 'Cancelled', color: 'text-slate-500 dark:text-slate-400' };
  if (isOverdueTask(task)) return { label: 'Overdue', color: 'text-red-600 dark:text-red-400' };
  if (isDueToday(task)) return { label: 'Due Today', color: 'text-amber-600 dark:text-amber-400' };
  if (task.priority === 'urgent') return { label: 'High Impact', color: 'text-red-600 dark:text-red-400' };
  if (task.priority === 'high') return { label: 'High Priority', color: 'text-orange-600 dark:text-orange-400' };
  if (task.status === 'in_progress') return { label: 'In Progress', color: 'text-blue-600 dark:text-blue-400' };
  const diffDays = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 86_400_000);
  if (diffDays <= 1) return { label: 'Recently Updated', color: 'text-emerald-600 dark:text-emerald-400' };
  return null;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.toLowerCase().trim();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/30 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

interface ProgressRingProps {
  progress: number;
  size?: number;
}

const ProgressRing = memo(function ProgressRing({ progress, size = 34 }: ProgressRingProps) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const [dashOffset, setDashOffset] = useState(circ);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDashOffset(circ - (progress / 100) * circ);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress, circ]);

  const color = progress === 100 ? '#10b981' : progress > 0 ? '#3b82f6' : '#94a3b8';

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
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums"
        style={{ color }}>
        {progress}%
      </span>
    </div>
  );
});

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: typeof ListTodo;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  displayValue: string;
  insight: string;
  trend?: { label: string; positive: boolean } | null;
  index: number;
}

const KpiCard = memo(function KpiCard({
  icon: Icon, iconBg, iconColor, label,
  value, displayValue, insight, trend, index,
}: KpiCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 800;
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

  const animatedDisplay = useMemo(() => {
    if (displayValue.endsWith('%')) return `${count}%`;
    return count.toLocaleString();
  }, [count, displayValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: prefersReducedMotion ? 0 : 0.35 }}
    >
      <Card className="rounded-xl border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-full">
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between mb-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
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
});

const SkeletonKpi = memo(function SkeletonKpi() {
  return (
    <Card className="rounded-xl border-border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
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

// ─── Saved Views ──────────────────────────────────────────────────────────────

interface SavedView {
  id: string;
  label: string;
  status: string;
  priority: string;
  overdueOnly: boolean;
}

const SAVED_VIEWS: SavedView[] = [
  { id: 'all',           label: 'All Tasks',         status: 'all',         priority: 'all', overdueOnly: false },
  { id: 'my-tasks',      label: 'My Tasks',          status: 'all',         priority: 'all', overdueOnly: false },
  { id: 'today',         label: 'Due Today',         status: 'all',         priority: 'all', overdueOnly: false },
  { id: 'overdue',       label: 'Overdue',           status: 'all',         priority: 'all', overdueOnly: true },
  { id: 'high-priority', label: 'High Priority',     status: 'all',         priority: 'high', overdueOnly: false },
  { id: 'completed',     label: 'Completed',         status: 'completed',   priority: 'all', overdueOnly: false },
  { id: 'blocked',       label: 'Blocked',           status: 'cancelled',   priority: 'all', overdueOnly: false },
  { id: 'recent',        label: 'Recently Updated',  status: 'all',         priority: 'all', overdueOnly: false },
];

// ─── Sort config ─────────────────────────────────────────────────────────────

type SortField = 'title' | 'priority' | 'status' | 'due_date' | 'updated_at';
type SortDir = 'asc' | 'desc';

const sortOptions: { field: SortField; label: string }[] = [
  { field: 'title',      label: 'Task Name' },
  { field: 'priority',   label: 'Priority' },
  { field: 'status',     label: 'Status' },
  { field: 'due_date',   label: 'Due Date' },
  { field: 'updated_at', label: 'Recently Updated' },
];

const priorityOrder: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

// ─── Main Component ──────────────────────────────────────────────────────────

export function TasksPage() {
  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [activeView, setActiveView] = useState('all');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const prefersReducedMotion = useReducedMotion();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Data
  const { data: tasksResponse, isLoading: loading, refetch: loadTasks, isError } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const bulkDeleteTasks = useDeleteTasks();
  const completeTask = useCompleteTask();

  const { data: leadsResponse } = useLeads();
  const leads = useMemo(() => (leadsResponse?.data || []) as Lead[], [leadsResponse]);

  const { data: customersResponse } = useCustomers();
  const customers = useMemo(() => (customersResponse?.data || []) as Customer[], [customersResponse]);

  const tasks = useMemo(() => (tasksResponse?.data || []) as Task[], [tasksResponse]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, priorityFilter, activeView]);

  // ── Entity name lookup ─────────────────────────────────────────────────────

  const getEntityName = useCallback((type: string | null, id: string | null): string | null => {
    if (!type || type === 'none' || !id) return null;
    if (type === 'lead') {
      const lead = leads.find((l: Lead) => l.id === id);
      return lead ? `${lead.name}${lead.company ? ` · ${lead.company}` : ''}` : null;
    }
    const customer = customers.find((c: Customer) => c.id === id);
    return customer ? `${customer.name}${customer.company ? ` · ${customer.company}` : ''}` : null;
  }, [leads, customers]);

  // ── Filtering (memoized) ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    const view = SAVED_VIEWS.find(v => v.id === activeView);
    return tasks.filter((t: Task) => {
      const matchesSearch = !q ||
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.assigned_to || '').toLowerCase().includes(q) ||
        (getEntityName(t.entity_type, t.entity_id) || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchesViewStatus = !view || view.status === 'all' || t.status === view.status;
      const matchesViewPriority = !view || view.priority === 'all' || t.priority === view.priority;
      const matchesOverdue = !view || !view.overdueOnly || isOverdueTask(t);
      const matchesToday = activeView !== 'today' || isDueToday(t);
      const matchesRecent = activeView !== 'recent' || Math.floor((Date.now() - new Date(t.updated_at).getTime()) / 86_400_000) <= 3;
      return matchesSearch && matchesStatus && matchesPriority && matchesViewStatus && matchesViewPriority && matchesOverdue && matchesToday && matchesRecent;
    });
  }, [tasks, debouncedSearch, statusFilter, priorityFilter, activeView, getEntityName]);

  // ── Sorting (memoized) ────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: Task, b: Task) => {
      let cmp = 0;
      switch (sortField) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'priority': cmp = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'due_date': {
          const aTime = a.due_date ? new Date(a.due_date).getTime() : 0;
          const bTime = b.due_date ? new Date(b.due_date).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        case 'updated_at': cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // ── Pagination ───────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const startIdx = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, sorted.length);

  // ── KPI stats ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const open = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const overdue = open.filter(isOverdueTask);
    const dueToday = open.filter(isDueToday);
    const blocked = tasks.filter(t => t.status === 'cancelled');
    const today = new Date().toISOString().split('T')[0];
    const completedToday = completedTasks.filter(t => t.completed_at && t.completed_at.startsWith(today));
    const weekAgo = Date.now() - 7 * 86_400_000;
    const completedThisWeek = completedTasks.filter(t => t.completed_at && new Date(t.completed_at).getTime() > weekAgo);
    const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    const highestPriorityDue = dueToday.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])[0];
    return {
      open: open.length,
      dueToday: dueToday.length,
      completionRate,
      blocked: blocked.length,
      completedToday: completedToday.length,
      completedThisWeek: completedThisWeek.length,
      overdue: overdue.length,
      highestPriorityDue,
      total: tasks.length,
    };
  }, [tasks]);

  // ── AI Priority Insights ────────────────────────────────────────────────────

  const aiInsights = useMemo(() => {
    const all: Array<{
      id: string; category: 'Risk' | 'Opportunity' | 'Trend' | 'Recommendation' | 'Summary';
      accentColor: string; title: string; description: string; action: string;
    }> = [];

    if (stats.overdue > 0) {
      all.push({
        id: 'risk-overdue',
        category: 'Risk',
        accentColor: 'border-rose-500',
        title: `${stats.overdue} overdue task${stats.overdue > 1 ? 's need' : ' needs'} immediate attention`,
        description: `These tasks have passed their due dates and are still open. Complete them today or reschedule to prevent bottlenecks in your workflow.`,
        action: 'View Overdue',
      });
    }

    if (stats.dueToday > 0) {
      all.push({
        id: 'opp-today',
        category: 'Opportunity',
        accentColor: 'border-amber-500',
        title: `${stats.dueToday} task${stats.dueToday > 1 ? 's are' : ' is'} due today`,
        description: stats.highestPriorityDue
          ? `Highest priority: "${stats.highestPriorityDue.title}". Focus on completing today's tasks to maintain momentum.`
          : `Focus on completing today's tasks to maintain momentum and avoid falling behind.`,
        action: 'View Today',
      });
    }

    if (stats.completionRate > 0) {
      all.push({
        id: 'trend-completion',
        category: 'Trend',
        accentColor: 'border-blue-500',
        title: `Completion rate at ${stats.completionRate}%`,
        description: `${stats.completedThisWeek} task${stats.completedThisWeek !== 1 ? 's were' : ' was'} completed this week. ${stats.completionRate >= 50 ? 'Great progress — keep the momentum going.' : 'Consider prioritizing fewer tasks to improve throughput.'}`,
        action: 'View Completed',
      });
    }

    if (stats.blocked > 0) {
      all.push({
        id: 'rec-blocked',
        category: 'Recommendation',
        accentColor: 'border-violet-500',
        title: `${stats.blocked} cancelled task${stats.blocked > 1 ? 's need' : ' needs'} review`,
        description: `Cancelled tasks may indicate blocked work or changing priorities. Review and either reactivate or archive them to keep your workspace clean.`,
        action: 'Review Cancelled',
      });
    }

    if (stats.completedToday > 0) {
      all.push({
        id: 'sum-productivity',
        category: 'Summary',
        accentColor: 'border-sky-500',
        title: `${stats.completedToday} task${stats.completedToday > 1 ? 's completed' : ' completed'} today`,
        description: `Productivity is ${stats.completedToday >= 3 ? 'high' : 'steady'}. ${stats.open > 0 ? `${stats.open} tasks remain open — prioritize by due date and impact.` : 'All tasks are handled. Consider planning ahead.'}`,
        action: 'View All',
      });
    }

    // Ensure at least 4
    if (all.length < 4) {
      all.push({
        id: 'rec-cadence',
        category: 'Recommendation',
        accentColor: 'border-emerald-500',
        title: 'Break large tasks into smaller subtasks',
        description: 'Tasks under 2 hours are 3x more likely to be completed on time. Consider splitting complex work into manageable pieces.',
        action: 'Create Task',
      });
    }

    return all.filter(i => !Array.from(dismissedInsights).includes(i.id));
  }, [stats, dismissedInsights]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openAdd = useCallback(() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }, []);

  const openEdit = useCallback((task: Task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || '',
      entity_type: (task.entity_type as TaskForm['entity_type']) || 'none',
      entity_id: task.entity_id || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
    });
    setDialogOpen(true);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      entity_type: form.entity_type === 'none' ? null : form.entity_type,
      entity_id: form.entity_id || null,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    };
    if (editingId) {
      updateTask.mutate({ id: editingId, data: payload }, { onSuccess: () => { setDialogOpen(false); loadTasks(); } });
    } else {
      createTask.mutate(payload as Partial<Task> & { title: string }, { onSuccess: () => { setDialogOpen(false); loadTasks(); } });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteTaskMutation.mutate(deleteId, { onSuccess: () => { setDeleteId(null); setSelectedTaskId(null); loadTasks(); } });
  };

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkDeleteTasks.mutate(ids, { onSuccess: () => { setSelectedIds(new Set()); loadTasks(); } });
  }, [selectedIds, bulkDeleteTasks, loadTasks]);

  const handleBulkComplete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    ids.forEach(id => completeTask.mutate(id));
    setSelectedIds(new Set());
  }, [selectedIds, completeTask]);

  const handleDuplicate = useCallback((task: Task) => {
    createTask.mutate({
      title: `${task.title} (Copy)`,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date,
      assigned_to: task.assigned_to,
      entity_type: task.entity_type as 'customer' | 'lead' | 'none' | null,
      entity_id: task.entity_id,
    }, { onSuccess: () => loadTasks() });
  }, [createTask, loadTasks]);

  const handleBulkDuplicate = useCallback(() => {
    const tasksToDup = tasks.filter(t => selectedIds.has(t.id));
    tasksToDup.forEach(task => {
      createTask.mutate({
        title: `${task.title} (Copy)`,
        description: task.description,
        priority: task.priority,
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        entity_type: task.entity_type as 'customer' | 'lead' | 'none' | null,
        entity_id: task.entity_id,
      });
    });
    setSelectedIds(new Set());
    setTimeout(loadTasks, 500);
  }, [selectedIds, tasks, createTask, loadTasks]);

  const toggleStatus = useCallback((task: Task) => {
    if (task.status === 'completed') {
      updateTask.mutate({ id: task.id, data: { status: 'pending', completed_at: null } });
    } else {
      completeTask.mutate(task.id);
    }
  }, [updateTask, completeTask]);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTaskId(task.id);
    setSheetOpen(true);
  }, []);

  const applyView = useCallback((view: SavedView) => {
    setActiveView(view.id);
    setStatusFilter(view.status);
    setPriorityFilter(view.priority);
    setSearch('');
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (paginated.every(t => selectedIds.has(t.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(t => next.add(t.id));
        return next;
      });
    }
  }, [paginated, selectedIds]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearch('');
    setActiveView('all');
  }, []);

  const handleExport = useCallback(() => {
    const headers = ['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Assigned To', 'Created At'];
    const rows = sorted.map(t => [
      t.title,
      t.description || '',
      t.status,
      t.priority,
      t.due_date || '',
      t.assigned_to || '',
      t.created_at,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tasks exported');
  }, [sorted]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (priorityFilter !== 'all' ? 1 : 0) + (debouncedSearch ? 1 : 0) + (activeView !== 'all' ? 1 : 0);

  const hasNoTasks = !loading && tasks.length === 0;
  const hasNoResults = !loading && tasks.length > 0 && sorted.length === 0;

  const entityOptions = form.entity_type === 'lead' ? leads : customers;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 p-6 pb-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Plan, prioritize and complete work across your organization.</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-0.5">
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-[11px] text-muted-foreground/60">Updated just now</p>
          </div>
        </div>

        {/* ── Action buttons row ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Button onClick={openAdd} className="gap-2 bg-gradient-to-r from-sky-500 to-blue-600 shadow-md shadow-blue-500/20">
            <Plus className="h-4 w-4" /> New Task
          </Button>
          <Button variant="outline" onClick={() => toast.info('Import functionality available in Settings')} className="gap-2">
            <Upload className="h-4 w-4" /> Import Tasks
          </Button>
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <SkeletonKpi key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              index={0}
              icon={ListTodo}
              iconBg="bg-blue-100 dark:bg-blue-900/40"
              iconColor="text-blue-600 dark:text-blue-400"
              label="Open Tasks"
              value={stats.open}
              displayValue={String(stats.open)}
              trend={stats.completedToday > 0 ? { label: `${stats.completedToday} completed today`, positive: true } : null}
              insight={stats.open > 0 ? `${stats.overdue} overdue · ${stats.dueToday} due today` : 'No open tasks.'}
            />
            <KpiCard
              index={1}
              icon={Calendar}
              iconBg="bg-amber-100 dark:bg-amber-900/40"
              iconColor="text-amber-600 dark:text-amber-400"
              label="Due Today"
              value={stats.dueToday}
              displayValue={String(stats.dueToday)}
              trend={null}
              insight={stats.dueToday > 0
                ? stats.highestPriorityDue
                  ? `Top: ${stats.highestPriorityDue.title.slice(0, 30)}`
                  : 'Prioritize by impact.'
                : 'No tasks due today.'}
            />
            <KpiCard
              index={2}
              icon={CheckCircle2}
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
              iconColor="text-emerald-600 dark:text-emerald-400"
              label="Completion Rate"
              value={stats.completionRate}
              displayValue={`${stats.completionRate}%`}
              trend={stats.completedThisWeek > 0 ? { label: `${stats.completedThisWeek} completed this week`, positive: true } : null}
              insight={stats.completionRate >= 50 ? 'Completion rate improved this week.' : 'Focus on completing open tasks.'}
            />
            <KpiCard
              index={3}
              icon={AlertCircle}
              iconBg={stats.blocked > 0 ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}
              iconColor={stats.blocked > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'}
              label="Blocked Tasks"
              value={stats.blocked}
              displayValue={String(stats.blocked)}
              trend={null}
              insight={stats.blocked > 0
                ? `${stats.blocked} task${stats.blocked > 1 ? 's are' : ' is'} waiting for review.`
                : 'No blocked work.'}
            />
          </div>
        )}

        {/* ── AI Priority Panel ──────────────────────────────────────────── */}
        {!loading && aiInsights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-500" />
              <p className="text-sm font-semibold">AI Priority</p>
              <span className="text-[11px] text-muted-foreground">Smart recommendations from your workspace</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <AnimatePresence>
                {aiInsights.slice(0, 4).map(insight => {
                  const categoryColors: Record<string, string> = {
                    Risk: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                    Opportunity: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                    Trend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                    Recommendation: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
                    Summary: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
                  };
                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className={cn('rounded-lg border-l-4 bg-muted/30 p-3', insight.accentColor)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
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
                        <button
                          onClick={() => {
                            if (insight.action === 'View Overdue') { setActiveView('overdue'); }
                            else if (insight.action === 'View Today') { setActiveView('today'); }
                            else if (insight.action === 'View Completed') { setActiveView('completed'); }
                            else if (insight.action === 'Review Cancelled') { setActiveView('blocked'); }
                            else if (insight.action === 'View All') { setActiveView('all'); }
                            else if (insight.action === 'Create Task') openAdd();
                          }}
                          className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                        >
                          {insight.action} <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Saved Views ────────────────────────────────────────────────── */}
        {!loading && tasks.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {SAVED_VIEWS.map(view => (
              <button
                key={view.id}
                onClick={() => applyView(view)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-all',
                  activeView === view.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        {!hasNoTasks && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks, projects, assignees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                aria-label="Search tasks"
              />
              {search && (
                <button
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'all', label: 'All', filter: 'status' as const },
                { key: 'today', label: 'Today', filter: 'special' as const },
                { key: 'overdue', label: 'Overdue', filter: 'special' as const },
                { key: 'urgent', label: 'Critical', filter: 'priority' as const },
                { key: 'high', label: 'High', filter: 'priority' as const },
                { key: 'pending', label: 'Todo', filter: 'status' as const },
                { key: 'in_progress', label: 'In Progress', filter: 'status' as const },
                { key: 'completed', label: 'Completed', filter: 'status' as const },
                { key: 'cancelled', label: 'Blocked', filter: 'status' as const },
              ].map(chip => {
                const isActive = chip.filter === 'status'
                  ? statusFilter === chip.key
                  : priorityFilter === chip.key;
                const onClick = () => {
                  if (chip.filter === 'special') {
                    setActiveView(isActive ? 'all' : chip.key);
                    setStatusFilter('all');
                    setPriorityFilter('all');
                  } else if (chip.filter === 'status') {
                    setStatusFilter(isActive ? 'all' : chip.key);
                    setActiveView('all');
                  } else {
                    setPriorityFilter(isActive ? 'all' : chip.key);
                    setActiveView('all');
                  }
                };
                return (
                  <button
                    key={chip.key}
                    onClick={onClick}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> List
              </Button>
              <Button
                variant={viewMode === 'board' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setViewMode('board')}
                aria-label="Board view"
              >
                <KanbanSquare className="h-3.5 w-3.5" /> Board
              </Button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {sortOptions.map(opt => (
                    <DropdownMenuItem key={opt.field} onClick={() => toggleSort(opt.field)} className="flex items-center justify-between">
                      <span>{opt.label}</span>
                      {sortField === opt.field && (
                        sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>

              <Button size="sm" className="gap-1.5 h-9 bg-gradient-to-r from-sky-500 to-blue-600 shadow-sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>
          </div>
        )}

        {/* ── Active filter chips ────────────────────────────────────────── */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Filters ({activeFilterCount}):</span>
            {statusFilter !== 'all' && (
              <Badge variant="outline" className="gap-1 capitalize">
                Status: {statusConfig[statusFilter as TaskStatus]?.label || statusFilter}
                <button aria-label="Remove status filter" onClick={() => setStatusFilter('all')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {priorityFilter !== 'all' && (
              <Badge variant="outline" className="gap-1 capitalize">
                Priority: {priorityFilter}
                <button aria-label="Remove priority filter" onClick={() => setPriorityFilter('all')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {activeView !== 'all' && (
              <Badge variant="outline" className="gap-1">
                View: {SAVED_VIEWS.find(v => v.id === activeView)?.label}
                <button aria-label="Remove view filter" onClick={() => setActiveView('all')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {debouncedSearch && (
              <Badge variant="outline" className="gap-1">
                Search: &quot;{debouncedSearch}&quot;
                <button aria-label="Clear search" onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            <button onClick={clearFilters} className="text-xs text-sky-600 dark:text-sky-400 hover:underline">Clear All</button>
          </div>
        )}

        {/* ── Error State ─────────────────────────────────────────────────── */}
        {isError && !loading && (
          <Card className="rounded-xl border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
              <p className="text-sm font-semibold">We couldn&apos;t load your tasks.</p>
              <p className="text-xs text-muted-foreground mt-1">Something went wrong on our end. Please try again.</p>
              <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => loadTasks()}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Empty onboarding ────────────────────────────────────────────── */}
        {hasNoTasks && !isError && (
          <Card className="rounded-xl border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/20 mb-4">
                <ListTodo className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Create your first task</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Organize work, collaborate with your team and track progress from one intelligent workspace.
              </p>
              <div className="flex gap-3 mt-5 flex-wrap justify-center">
                <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Create Task</Button>
                <Button variant="outline" onClick={() => toast.info('Import functionality available in Settings')} className="gap-2"><Upload className="h-4 w-4" /> Import Tasks</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── No results (filtered) ───────────────────────────────────────── */}
        {hasNoResults && (
          <Card className="rounded-xl border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold">No tasks match your filters.</p>
              <p className="text-xs text-muted-foreground mt-1">Try removing filters or broadening your search.</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={clearFilters}>Clear Filters</Button>
                <Button size="sm" onClick={openAdd} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create Task</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Bulk selection toolbar ─────────────────────────────────────── */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="rounded-xl border-border bg-card shadow-md sticky top-0 z-10">
                <CardContent className="flex items-center justify-between gap-3 py-3 px-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sky-500" />
                    <span className="text-sm font-medium">{selectedIds.size} Task{selectedIds.size > 1 ? 's' : ''} Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => toast.info('Bulk assign coming soon')}>
                      <User className="h-3.5 w-3.5" /> Assign
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={handleBulkComplete}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={handleBulkDuplicate}>
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={handleExport}>
                      <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive" onClick={handleBulkDelete}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIds(new Set())}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Task Workspace ───────────────────────────────────────────── */}
        {!loading && !hasNoTasks && !hasNoResults && !isError && (
          <>
          {/* Board View */}
          {viewMode === 'board' && (
            <div className="hidden md:block overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-fit">
                {(['pending', 'in_progress', 'completed', 'cancelled'] as TaskStatus[]).map(colStatus => {
                  const colTasks = sorted.filter(t => t.status === colStatus);
                  const colCfg = statusConfig[colStatus];
                  return (
                    <div key={colStatus} className="w-72 shrink-0">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <colCfg.icon className={cn('h-3.5 w-3.5', colCfg.badge.split(' ').find(c => c.startsWith('text')))} />
                          <span className="text-xs font-semibold">{colCfg.label}</span>
                          <span className="text-[10px] text-muted-foreground">{colTasks.length}</span>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {colTasks.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border p-6 text-center">
                            <p className="text-xs text-muted-foreground">No tasks</p>
                          </div>
                        ) : colTasks.map((task: Task) => {
                          const priority = priorityConfig[task.priority];
                          const entityName = getEntityName(task.entity_type, task.entity_id);
                          const indicator = getTaskIndicator(task);
                          const overdue = isOverdueTask(task);
                          return (
                            <Card key={task.id} className="rounded-lg border-border bg-card shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                              onClick={() => handleTaskClick(task)}>
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2 mb-2">
                                  <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', priority.badge)}>
                                    <priority.icon className="h-3 w-3" />
                                  </div>
                                  <p className={cn('text-xs font-medium leading-tight flex-1', task.status === 'completed' && 'line-through text-muted-foreground')}>
                                    {highlightMatch(task.title, debouncedSearch)}
                                  </p>
                                </div>
                                {entityName && <p className="text-[10px] text-muted-foreground mb-2 truncate">{entityName}</p>}
                                <div className="flex items-center justify-between gap-1.5">
                                  <Badge variant="outline" className={cn('text-[9px]', priority.badge)}>{priority.label}</Badge>
                                  {task.due_date && (
                                    <span className={cn('text-[10px]', overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground')}>
                                      {formatRelativeDate(task.due_date)}
                                    </span>
                                  )}
                                </div>
                                {indicator && (
                                  <div className="mt-1.5">
                                    <span className={cn('text-[9px] font-medium', indicator.color)}>{indicator.label}</span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View — Desktop table */}
          {viewMode === 'list' && (
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={paginated.length > 0 && paginated.every(t => selectedIds.has(t.id))}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('title')}>
                      <div className="flex items-center gap-1">
                        Task
                        {sortField === 'title' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('priority')}>
                      <div className="flex items-center gap-1">
                        Priority
                        {sortField === 'priority' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                      <div className="flex items-center gap-1">
                        Status
                        {sortField === 'status' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Est. Time</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('due_date')}>
                      <div className="flex items-center gap-1">
                        Due Date
                        {sortField === 'due_date' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('updated_at')}>
                      <div className="flex items-center gap-1">
                        Updated
                        {sortField === 'updated_at' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-10 text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {paginated.map((task: Task, i: number) => {
                      const priority = priorityConfig[task.priority];
                      const status = statusConfig[task.status];
                      const progress = getProgress(task);
                      const entityName = getEntityName(task.entity_type, task.entity_id);
                      const indicator = getTaskIndicator(task);
                      const overdue = isOverdueTask(task);
                      return (
                        <motion.tr
                          key={task.id}
                          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: prefersReducedMotion ? 0 : i * 0.02, duration: prefersReducedMotion ? 0 : 0.2 }}
                          className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                          onClick={() => handleTaskClick(task)}
                        >
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(task.id)}
                              onCheckedChange={() => toggleSelect(task.id)}
                              aria-label={`Select ${task.title}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                priority.badge,
                              )}>
                                <priority.icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className={cn('truncate text-sm font-medium leading-tight', task.status === 'completed' && 'line-through text-muted-foreground')}>
                                  {highlightMatch(task.title, debouncedSearch)}
                                </p>
                                {task.description && (
                                  <p className="truncate text-[11px] text-muted-foreground">{highlightMatch(task.description, debouncedSearch)}</p>
                                )}
                                {indicator && (
                                  <span className={cn('text-[10px] font-medium', indicator.color)}>{indicator.label}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="truncate text-sm">{entityName || 'Personal Task'}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {task.entity_type === 'lead' ? 'Lead' : task.entity_type === 'customer' ? 'Customer' : 'No link'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px]', priority.badge)}>
                              {priority.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px]', status.badge)}>
                              <status.icon className="mr-1 h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div><ProgressRing progress={progress} size={34} /></div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs font-medium">{getProgressLabel(task)}</p>
                                <p className="text-xs text-muted-foreground">{progress}% complete</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              Not estimated
                            </span>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'text-xs',
                                  overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground',
                                )}>
                                  {formatRelativeDate(task.due_date)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {task.due_date ? formatExactDate(task.due_date) : 'No due date'}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {task.assigned_to ? (
                              <div className="flex items-center gap-1.5">
                                <div className={cn(
                                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white bg-gradient-to-br',
                                  getAvatarGradient(task.assigned_to),
                                )}>
                                  {getInitials(task.assigned_to)}
                                </div>
                                <span className="truncate text-xs">{task.assigned_to}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground">{formatUpdated(task.updated_at)}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {formatExactDate(task.updated_at)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(task)} aria-label={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}>
                                    {task.status === 'completed'
                                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      : <Circle className="h-3.5 w-3.5" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">{task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}</TooltipContent>
                              </Tooltip>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => handleTaskClick(task)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" /> Open
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEdit(task)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleStatus(task)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> {task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicate(task)}>
                                    <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router_safe() }>
                                    <CalendarPlus className="h-3.5 w-3.5 mr-2" /> Schedule
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(task.id)}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((task: Task, i: number) => {
                const priority = priorityConfig[task.priority];
                const status = statusConfig[task.status];
                const progress = getProgress(task);
                const entityName = getEntityName(task.entity_type, task.entity_id);
                const indicator = getTaskIndicator(task);
                const overdue = isOverdueTask(task);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: prefersReducedMotion ? 0 : i * 0.02, duration: prefersReducedMotion ? 0 : 0.2 }}
                  >
                    <Card className="rounded-xl border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] cursor-pointer"
                      onClick={() => handleTaskClick(task)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStatus(task); }}
                              className="shrink-0"
                              aria-label={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
                            >
                              {task.status === 'completed'
                                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                : <Circle className="h-5 w-5 text-muted-foreground" />}
                            </button>
                            <div className="min-w-0">
                              <p className={cn('truncate text-sm font-semibold leading-tight', task.status === 'completed' && 'line-through text-muted-foreground')}>
                                {highlightMatch(task.title, debouncedSearch)}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">{entityName || 'Personal Task'}</p>
                              {indicator && (
                                <span className={cn('text-[10px] font-medium', indicator.color)}>{indicator.label}</span>
                              )}
                            </div>
                          </div>
                          <ProgressRing progress={progress} size={36} />
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn('text-[10px]', priority.badge)}>{priority.label}</Badge>
                            <Badge variant="outline" className={cn('text-[10px]', status.badge)}>
                              <status.icon className="mr-1 h-3 w-3" />{status.label}
                            </Badge>
                          </div>
                          <span className={cn('text-[11px]', overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground')}>
                            {formatRelativeDate(task.due_date)}
                          </span>
                        </div>
                        {task.assigned_to && (
                          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white bg-gradient-to-br',
                                getAvatarGradient(task.assigned_to),
                              )}>
                                {getInitials(task.assigned_to)}
                              </div>
                              <span className="text-xs text-muted-foreground">{task.assigned_to}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(task); }} aria-label="Edit task">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(task.id); }} aria-label="Delete task">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Pagination (list view only) ──────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="ml-2">Showing {startIdx}–{endIdx} of {sorted.length} Tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Loading skeleton table ─────────────────────────────────────── */}
        {loading && (
          <>
            {/* Mobile skeleton */}
            <div className="md:hidden space-y-3">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="rounded-xl border-border bg-card shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-32 rounded" />
                        <Skeleton className="h-3 w-24 rounded" />
                      </div>
                      <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded" />
                      <Skeleton className="h-5 w-16 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Desktop skeleton */}
            <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="space-y-0">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="flex items-center gap-2.5 flex-1">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-40 rounded" />
                        <Skeleton className="h-2.5 w-24 rounded" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-4 w-14 rounded" />
                    <Skeleton className="h-4 w-14 rounded" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Dialogs ────────────────────────────────────────────────────── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Task' : 'New Task'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow up with prospect" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs to be done?" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Link To</Label>
                  <Select value={form.entity_type} onValueChange={(v) => { setForm({ ...form, entity_type: v as TaskForm['entity_type'], entity_id: '' }); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No link</SelectItem>
                      <SelectItem value="lead">A Lead</SelectItem>
                      <SelectItem value="customer">A Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact</Label>
                  <Select value={form.entity_id} onValueChange={(v) => setForm({ ...form, entity_id: v })} disabled={form.entity_type === 'none'}>
                    <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>
                      {entityOptions.map((entity: Lead | Customer) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.name}{entity.company ? ` · ${entity.company}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Team member name" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>{createTask.isPending || updateTask.isPending ? 'Saving...' : editingId ? 'Update' : 'Create Task'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Task?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone. The task will be permanently removed.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteTaskMutation.isPending}>{deleteTaskMutation.isPending ? 'Deleting...' : 'Delete'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TaskDetailSheet
          taskId={selectedTaskId}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onEdit={(task) => { setSheetOpen(false); openEdit(task); }}
          onDelete={(id) => { setSheetOpen(false); setDeleteId(id); }}
          onToggle={toggleStatus}
          onUpdated={loadTasks}
          getEntityName={getEntityName}
        />
      </div>
    </TooltipProvider>
  );
}

function router_safe() {
  toast.info('Schedule functionality coming soon');
}

// ─── Task Detail Sheet ───────────────────────────────────────────────────────

function TaskDetailSheet({
  taskId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onToggle,
  onUpdated,
  getEntityName,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggle: (task: Task) => void;
  onUpdated: () => void;
  getEntityName: (type: string | null, id: string | null) => string | null;
}) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: tasksResponse } = useTasks();
  const tasks = useMemo(() => (tasksResponse?.data || []) as Task[], [tasksResponse]);
  const task = useMemo(() => tasks.find(t => t.id === taskId) || null, [tasks, taskId]);

  const updateTask = useUpdateTask();

  if (!taskId) return null;

  const loading = !task;
  const priority = task ? priorityConfig[task.priority] : priorityConfig.medium;
  const status = task ? statusConfig[task.status] : statusConfig.pending;
  const progress = task ? getProgress(task) : 0;
  const entityName = task ? getEntityName(task.entity_type, task.entity_id) : null;
  const overdue = task ? isOverdueTask(task) : false;
  const indicator = task ? getTaskIndicator(task) : null;

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!task) return;
    if (newStatus === 'completed') {
      onToggle(task);
    } else {
      updateTask.mutate({ id: task.id, data: { status: newStatus } }, { onSuccess: onUpdated });
    }
  };

  const handlePriorityChange = (newPriority: TaskPriority) => {
    if (!task) return;
    updateTask.mutate({ id: task.id, data: { priority: newPriority } }, { onSuccess: onUpdated });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !task ? (
          <div className="text-center py-20 text-muted-foreground">Not found</div>
        ) : (
          <>
            <SheetHeader className="space-y-1 pb-4 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl',
                    priority.badge,
                  )}>
                    <priority.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{task.title}</SheetTitle>
                    {task.description && (
                      <SheetDescription className="mt-0.5">{task.description}</SheetDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(task)} aria-label="Edit task">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task.id)} aria-label="Delete task">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Quick actions bar */}
            <div className="flex items-center gap-2 py-3 border-b flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onToggle(task)}>
                {task.status === 'completed' ? <Circle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {task.status === 'completed' ? 'Mark Incomplete' : 'Complete'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(task)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>

              {/* Status selector */}
              <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                <SelectTrigger className="h-8 w-auto">
                  <Badge variant="outline" className={cn('text-[10px]', status.badge)}>
                    <status.icon className="mr-1 h-3 w-3" />{status.label}
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{statusConfig[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority selector */}
              <Select value={task.priority} onValueChange={(v) => handlePriorityChange(v as TaskPriority)}>
                <SelectTrigger className="h-8 w-auto">
                  <Badge variant="outline" className={cn('text-[10px]', priority.badge)}>
                    {priority.label}
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{priorityConfig[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info pills */}
            <div className="flex flex-wrap gap-2 py-3 border-b">
              {task.due_date && (
                <div className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs',
                  overdue ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-muted/50 text-muted-foreground',
                )}>
                  <Calendar className="h-3 w-3" />
                  {formatRelativeDate(task.due_date)}
                  {overdue && ' · Overdue'}
                </div>
              )}
              {task.assigned_to && (
                <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs">
                  <div className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white bg-gradient-to-br',
                    getAvatarGradient(task.assigned_to),
                  )}>
                    {getInitials(task.assigned_to)}
                  </div>
                  {task.assigned_to}
                </div>
              )}
              {entityName && (
                <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs">
                  {task.entity_type === 'lead' ? <Target className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {entityName}
                </div>
              )}
              {indicator && (
                <div className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', indicator.color)}>
                  {indicator.label}
                </div>
              )}
            </div>

            {/* Progress section */}
            <div className="py-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm font-semibold">{getProgressLabel(task)}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke={progress === 100 ? '#10b981' : progress > 0 ? '#3b82f6' : '#94a3b8'} strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${(progress / 100) * 175.9} 175.9`}
                      style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{progress}%</div>
                </div>
                <div className="flex-1 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="capitalize">{status.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span>{priority.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatUpdated(task.created_at)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{formatUpdated(task.updated_at)}</span></div>
                  {task.completed_at && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="text-emerald-600 dark:text-emerald-400">{formatUpdated(task.completed_at)}</span></div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="py-4 border-b">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-sky-500" />AI Insights</h4>
              <div className="grid grid-cols-1 gap-2">
                {overdue && (
                  <Card className="border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-rose-900 dark:text-rose-200">Overdue task</p>
                          <p className="text-xs text-rose-700 dark:text-rose-400">This task is past its due date. Consider completing or rescheduling.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {task.priority === 'urgent' && task.status !== 'completed' && (
                  <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-red-900 dark:text-red-200">Critical priority</p>
                          <p className="text-xs text-red-700 dark:text-red-400">Address this task immediately to prevent blockers.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {task.status === 'in_progress' && (
                  <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-200">In progress</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400">Task is actively being worked on. Update progress regularly.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {task.status === 'completed' && (
                  <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">Task completed</p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">Great work! This task has been finished successfully.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!overdue && task.priority !== 'urgent' && task.status !== 'in_progress' && task.status !== 'completed' && (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-muted-foreground text-sm">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Task is on track. No immediate actions needed.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{priority.label}</p><p className="text-xs text-muted-foreground">Priority</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{status.label}</p><p className="text-xs text-muted-foreground">Status</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{progress}%</p><p className="text-xs text-muted-foreground">Progress</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{task.due_date ? formatRelativeDate(task.due_date) : '—'}</p><p className="text-xs text-muted-foreground">Due Date</p></CardContent></Card>
                </div>
                {task.description && (
                  <Card className="border-border">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
                    <CardContent className="pt-0"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p></CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-4 mt-4">
                <Card className="border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Task Details</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span>{task.title}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span>{priority.label}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{status.label}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span>{task.due_date ? formatExactDate(task.due_date) : 'Not set'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Assigned To</span><span>{task.assigned_to || 'Unassigned'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Linked To</span><span>{entityName || 'No link'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatExactDate(task.created_at)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{formatExactDate(task.updated_at)}</span></div>
                    {task.completed_at && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="text-emerald-600 dark:text-emerald-400">{formatExactDate(task.completed_at)}</span></div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-4">
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <ActivityIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium">Activity Timeline</p>
                    <p className="text-xs text-muted-foreground mb-3">Track changes and updates to this task</p>
                    <Button variant="outline" size="sm" className="gap-1.5" asChild>
                      <a href="/activity">View All Activity <ChevronRight className="h-3 w-3" /></a>
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
