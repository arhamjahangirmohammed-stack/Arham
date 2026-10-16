'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomers, useCustomer, useUpdateCustomer, useDeleteCustomer, useDeleteCustomers, useExportCustomersCSV } from '@/hooks/useCustomers';
import { useNotesByEntity, useCreateNote } from '@/hooks/useNotes';
import { useTasksByEntity } from '@/hooks/useTasks';
import { useFollowUpsByEntity } from '@/hooks/useFollowUps';
import { Customer, Note, Task, Activity, FollowUp } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Pencil, Trash2, Users, Mail, Phone, Building2, DollarSign,
  Calendar, MessageSquare, FileText, CheckCircle, Clock, Star, TrendingUp,
  AlertCircle, ArrowRight, ExternalLink, Copy, Send, X, ChevronRight,
  Activity as ActivityIcon, Edit, Eye, Target, RefreshCw, AlertTriangle,
  ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, MoreHorizontal,
  MailOpen, PhoneCall, CalendarPlus, Sparkles, User, Heart, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const INDUSTRIES = ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Consulting', 'Real Estate', 'Media', 'Other'];
const STATUSES = ['active', 'prospect', 'churned', 'inactive'] as const;

type CustomerForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  status: Customer['status'];
  value: string;
};

const emptyForm: CustomerForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  industry: '',
  status: 'prospect',
  value: '0',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatExactDate(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatCurrencyFull(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
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
    'from-indigo-500 to-blue-500',
  ];
  return gradients[name.charCodeAt(0) % gradients.length];
}

// ─── Health Score ────────────────────────────────────────────────────────────

function getHealthScore(customer: Customer): number {
  if (customer.status === 'churned') return 20;
  if (customer.status === 'inactive') return 40;
  let score = customer.status === 'active' ? 90 : customer.status === 'prospect' ? 60 : 40;
  if ((customer.value || 0) > 50000) score += 5;
  if ((customer.value || 0) > 100000) score += 5;
  return Math.min(100, Math.max(0, score));
}

function healthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 30) return '#f59e0b';
  return '#ef4444';
}

function healthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Healthy';
  if (score >= 30) return 'Fair';
  return 'Needs Attention';
}

// ─── Status & Type config ────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  active: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  prospect: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  churned: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
  inactive: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

function getCustomerType(customer: Customer): { label: string; className: string } {
  const value = customer.value || 0;
  if (value >= 100000) return { label: 'VIP', className: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300' };
  if (value >= 50000) return { label: 'Enterprise', className: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
  if (value >= 10000) return { label: 'Business', className: 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' };
  if (customer.status === 'prospect') return { label: 'Prospect', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  return { label: 'Individual', className: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' };
}

// ─── Follow-up indicator ──────────────────────────────────────────────────────

function getFollowUpIndicator(customer: Customer): { label: string; color: string } | null {
  const daysSinceUpdate = Math.floor((Date.now() - new Date(customer.updated_at).getTime()) / 86_400_000);
  if (customer.status === 'churned') return { label: 'Churned', color: 'text-rose-600 dark:text-rose-400' };
  if (customer.status === 'inactive') return { label: 'Inactive', color: 'text-slate-500 dark:text-slate-400' };
  if (daysSinceUpdate > 60) return { label: 'Inactive 60d+', color: 'text-amber-600 dark:text-amber-400' };
  if (customer.status === 'prospect') return { label: 'Prospect', color: 'text-blue-600 dark:text-blue-400' };
  if ((customer.value || 0) >= 100000) return { label: 'High Value', color: 'text-violet-600 dark:text-violet-400' };
  if (daysSinceUpdate <= 2) return { label: 'Recently active', color: 'text-emerald-600 dark:text-emerald-400' };
  return null;
}

// ─── ScoreRing (shared) ──────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  size?: number;
}

const ScoreRing = memo(function ScoreRing({ score, size = 36 }: ScoreRingProps) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const [dashOffset, setDashOffset] = useState(circ);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDashOffset(circ - (score / 100) * circ);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circ]);

  const color = healthColor(score);

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

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: typeof Users;
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
    if (displayValue.startsWith('$')) return formatCurrency(count);
    return count.toLocaleString();
  }, [count, displayValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
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
  minValue: number;
}

const SAVED_VIEWS: SavedView[] = [
  { id: 'all',          label: 'All Customers',    status: 'all',       minValue: 0 },
  { id: 'vip',          label: 'VIP',              status: 'all',       minValue: 100000 },
  { id: 'enterprise',   label: 'Enterprise',       status: 'all',       minValue: 50000 },
  { id: 'recent',       label: 'Recently Added',    status: 'all',       minValue: 0 },
  { id: 'follow-up',    label: 'Needs Follow-up',   status: 'all',       minValue: 0 },
  { id: 'inactive',     label: 'Inactive',          status: 'inactive',  minValue: 0 },
  { id: 'active',       label: 'Active',            status: 'active',     minValue: 0 },
];

// ─── Sort config ─────────────────────────────────────────────────────────────

type SortField = 'name' | 'company' | 'value' | 'status' | 'updated_at';
type SortDir = 'asc' | 'desc';

const sortOptions: { field: SortField; label: string }[] = [
  { field: 'name',       label: 'Customer Name' },
  { field: 'company',    label: 'Company' },
  { field: 'value',      label: 'Lifetime Value' },
  { field: 'status',     label: 'Status' },
  { field: 'updated_at', label: 'Recently Updated' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function CustomersPage() {
  const router = useRouter();

  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minValue, setMinValue] = useState(0);
  const [activeView, setActiveView] = useState('all');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Data
  const { data: customersResponse, isLoading: loading, refetch: loadCustomers, isError } = useCustomers();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();
  const bulkDeleteCustomers = useDeleteCustomers();
  const exportMutation = useExportCustomersCSV();

  const customers = useMemo(() => (customersResponse?.data || []) as Customer[], [customersResponse]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, minValue, activeView]);

  // ── Filtering (memoized) ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return customers.filter((c: Customer) => {
      const matchesSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.industry || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesValue = minValue === 0 || (c.value || 0) >= minValue;
      return matchesSearch && matchesStatus && matchesValue;
    });
  }, [customers, debouncedSearch, statusFilter, minValue]);

  // ── Sorting (memoized) ────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: Customer, b: Customer) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'company': cmp = (a.company || '').localeCompare(b.company || ''); break;
        case 'value': cmp = (a.value || 0) - (b.value || 0); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
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
    const active = customers.filter(c => c.status === 'active');
    const totalValue = customers.reduce((s, c) => s + (c.value || 0), 0);
    const avgValue = customers.length > 0 ? totalValue / customers.length : 0;
    const monthAgo = Date.now() - 30 * 86_400_000;
    const activeThisMonth = customers.filter(c => new Date(c.updated_at).getTime() > monthAgo).length;
    const needsAttention = customers.filter(c => {
      if (c.status === 'churned' || c.status === 'inactive') return true;
      const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86_400_000);
      return days > 30;
    }).length;
    const vipCount = customers.filter(c => (c.value || 0) >= 100000).length;
    return { total: customers.length, active: active.length, totalValue, avgValue, activeThisMonth, needsAttention, vipCount };
  }, [customers]);

  // ── AI Insights ────────────────────────────────────────────────────────────

  const aiInsights = useMemo(() => {
    const all: Array<{
      id: string; category: 'Risk' | 'Opportunity' | 'Trend' | 'Recommendation' | 'Summary';
      accentColor: string; title: string; description: string; action: string;
    }> = [];

    if (stats.needsAttention > 0) {
      all.push({
        id: 'risk-attention',
        category: 'Risk',
        accentColor: 'border-rose-500',
        title: `${stats.needsAttention} customer${stats.needsAttention > 1 ? 's need' : ' needs'} attention`,
        description: `These customers are inactive or haven't been contacted in over 30 days. Reach out to prevent churn and maintain relationships.`,
        action: 'View At-Risk',
      });
    }

    if (stats.vipCount > 0) {
      const vipCustomers = customers.filter(c => (c.value || 0) >= 100000);
      const topVip = vipCustomers.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
      all.push({
        id: 'opp-vip',
        category: 'Opportunity',
        accentColor: 'border-emerald-500',
        title: `${stats.vipCount} VIP customer${stats.vipCount > 1 ? 's are' : ' is'} driving revenue`,
        description: `${topVip.name}${topVip.company ? ` at ${topVip.company}` : ''} leads with ${formatCurrencyFull(topVip.value || 0)} in lifetime value. Ensure regular engagement to retain key accounts.`,
        action: 'View VIPs',
      });
    }

    if (stats.totalValue > 0) {
      all.push({
        id: 'trend-value',
        category: 'Trend',
        accentColor: 'border-blue-500',
        title: `Total lifetime value: ${formatCurrencyFull(stats.totalValue)}`,
        description: `Across ${stats.total} customers, the average lifetime value is ${formatCurrencyFull(stats.avgValue)}. Active customers drive the majority of revenue.`,
        action: 'View All',
      });
    }

    const prospectCount = customers.filter(c => c.status === 'prospect').length;
    if (prospectCount > 0) {
      all.push({
        id: 'rec-prospect',
        category: 'Recommendation',
        accentColor: 'border-amber-500',
        title: `${prospectCount} prospect${prospectCount > 1 ? 's' : ''} awaiting conversion`,
        description: `Prospects are closest to becoming paying customers. Schedule demos or follow-up calls to move them through the funnel.`,
        action: 'View Prospects',
      });
    }

    if (stats.activeThisMonth > 0) {
      all.push({
        id: 'sum-active',
        category: 'Summary',
        accentColor: 'border-sky-500',
        title: `${stats.activeThisMonth} customer${stats.activeThisMonth > 1 ? 's were' : ' was'} active this month`,
        description: `Customer engagement is steady. Keep the momentum by logging interactions and scheduling regular check-ins.`,
        action: 'View Activity',
      });
    }

    // Ensure at least 4
    if (all.length < 4) {
      all.push({
        id: 'rec-cadence',
        category: 'Recommendation',
        accentColor: 'border-violet-500',
        title: 'Maintain consistent customer check-ins',
        description: 'Customers contacted regularly are 3x more likely to renew. Block time weekly for relationship management.',
        action: 'Create Task',
      });
    }

    return all.filter(i => !Array.from(dismissedInsights).includes(i.id));
  }, [stats, customers, dismissedInsights]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openAdd = useCallback(() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }, []);

  const openEdit = useCallback((customer: Customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      industry: customer.industry || '',
      status: customer.status,
      value: String(customer.value || 0),
    });
    setDialogOpen(true);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      industry: form.industry || null,
      status: form.status,
      value: parseFloat(form.value) || 0,
    };

    if (editingId) {
      updateCustomer.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { setDialogOpen(false); setSaving(false); loadCustomers(); },
        onError: () => setSaving(false),
      });
    } else {
      const { error } = await supabase.from('customers').insert(payload).select().single();
      if (error) toast.error('Failed to create customer');
      else { toast.success('Customer added'); setDialogOpen(false); setSaving(false); loadCustomers(); }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteCustomerMutation.mutate(deleteId, {
      onSuccess: () => { setDeleteId(null); setSelectedCustomerId(null); loadCustomers(); },
    });
  };

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkDeleteCustomers.mutate(ids, { onSuccess: () => { setSelectedIds(new Set()); loadCustomers(); } });
  }, [selectedIds, bulkDeleteCustomers, loadCustomers]);

  const handleExport = useCallback(() => {
    exportMutation.mutate({});
  }, [exportMutation]);

  const handleCustomerClick = useCallback((customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setSheetOpen(true);
  }, []);

  const applyView = useCallback((view: SavedView) => {
    setActiveView(view.id);
    setStatusFilter(view.status);
    setMinValue(view.minValue);
    setSearch('');
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
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
    if (paginated.every(c => selectedIds.has(c.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(c => next.add(c.id));
        return next;
      });
    }
  }, [paginated, selectedIds]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setMinValue(0);
    setSearch('');
    setActiveView('all');
  }, []);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (minValue > 0 ? 1 : 0) + (debouncedSearch ? 1 : 0);

  const hasNoCustomers = !loading && customers.length === 0;
  const hasNoResults = !loading && customers.length > 0 && sorted.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 p-6 pb-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage customer relationships, retention and growth.</p>
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
            <Plus className="h-4 w-4" /> New Customer
          </Button>
          <Button variant="outline" onClick={() => router.push('/settings')} className="gap-2">
            <Upload className="h-4 w-4" /> Import Customers
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
              icon={Users}
              iconBg="bg-blue-100 dark:bg-blue-900/40"
              iconColor="text-blue-600 dark:text-blue-400"
              label="Total Customers"
              value={stats.total}
              displayValue={String(stats.total)}
              trend={stats.activeThisMonth > 0 ? { label: `${stats.activeThisMonth} active this month`, positive: true } : null}
              insight={stats.total > 0 ? `${stats.active} active · ${stats.total - stats.active} other` : 'No customers yet.'}
            />
            <KpiCard
              index={1}
              icon={Heart}
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
              iconColor="text-emerald-600 dark:text-emerald-400"
              label="Active Customers"
              value={stats.active}
              displayValue={String(stats.active)}
              trend={null}
              insight={stats.active > 0 ? `${Math.round((stats.active / Math.max(stats.total, 1)) * 100)}% of total base` : 'No active customers.'}
            />
            <KpiCard
              index={2}
              icon={DollarSign}
              iconBg="bg-violet-100 dark:bg-violet-900/40"
              iconColor="text-violet-600 dark:text-violet-400"
              label="Lifetime Value"
              value={stats.totalValue}
              displayValue={formatCurrency(stats.totalValue)}
              trend={null}
              insight={stats.totalValue > 0 ? `Avg ${formatCurrency(stats.avgValue)} per customer.` : 'No value recorded.'}
            />
            <KpiCard
              index={3}
              icon={AlertCircle}
              iconBg={stats.needsAttention > 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}
              iconColor={stats.needsAttention > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
              label="Needs Attention"
              value={stats.needsAttention}
              displayValue={String(stats.needsAttention)}
              trend={null}
              insight={stats.needsAttention > 0
                ? `${stats.needsAttention} customer${stats.needsAttention > 1 ? 's need' : ' needs'} follow-up.`
                : 'All customers are up to date.'}
            />
          </div>
        )}

        {/* ── AI Insights Panel ──────────────────────────────────────────── */}
        {!loading && aiInsights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-500" />
              <p className="text-sm font-semibold">AI Insights</p>
              <span className="text-[11px] text-muted-foreground">Derived from your customer base</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <AnimatePresence>
                {aiInsights.slice(0, 4).map(insight => {
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
                            if (insight.action === 'View At-Risk') { setStatusFilter('inactive'); setActiveView('inactive'); }
                            else if (insight.action === 'View VIPs') { setMinValue(100000); setActiveView('vip'); }
                            else if (insight.action === 'View Prospects') { setStatusFilter('prospect'); setActiveView('all'); }
                            else if (insight.action === 'View Activity') router.push('/activity');
                            else if (insight.action === 'Create Task') router.push('/tasks');
                            else router.push('/customers');
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
        {!loading && customers.length > 0 && (
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
        {!hasNoCustomers && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers, companies, emails…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                aria-label="Search customers"
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
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'prospect', label: 'Prospect' },
                { key: 'inactive', label: 'Inactive' },
                { key: 'churned', label: 'Churned' },
              ].map(chip => {
                const isActive = statusFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    onClick={() => { setStatusFilter(isActive ? 'all' : chip.key); setActiveView('all'); }}
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

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
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

              {/* Export */}
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExport} disabled={exportMutation.isPending}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>

              {/* New Customer */}
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
                Status: {statusFilter}
                <button aria-label="Remove status filter" onClick={() => setStatusFilter('all')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {minValue > 0 && (
              <Badge variant="outline" className="gap-1">
                Value: {formatCurrency(minValue)}+
                <button aria-label="Remove value filter" onClick={() => setMinValue(0)}><X className="h-3 w-3" /></button>
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
              <p className="text-sm font-semibold">We couldn&apos;t load your customers.</p>
              <p className="text-xs text-muted-foreground mt-1">Something went wrong on our end. Please try again.</p>
              <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => loadCustomers()}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Empty onboarding ────────────────────────────────────────────── */}
        {hasNoCustomers && !isError && (
          <Card className="rounded-xl border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/20 mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Create your first customer</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Build stronger customer relationships by managing every interaction in one place.
              </p>
              <div className="flex gap-3 mt-5 flex-wrap justify-center">
                <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Create Customer</Button>
                <Button variant="outline" onClick={() => router.push('/settings')} className="gap-2"><Upload className="h-4 w-4" /> Import CSV</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── No results (filtered) ───────────────────────────────────────── */}
        {hasNoResults && (
          <Card className="rounded-xl border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold">No customers match your filters.</p>
              <p className="text-xs text-muted-foreground mt-1">Try removing filters or broadening your search.</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={clearFilters}>Clear Filters</Button>
                <Button size="sm" onClick={openAdd} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create Customer</Button>
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
                    <CheckCircle className="h-4 w-4 text-sky-500" />
                    <span className="text-sm font-medium">{selectedIds.size} Customer{selectedIds.size > 1 ? 's' : ''} Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => router.push('/tasks')}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Assign
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={handleExport}>
                      <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => { const ids = Array.from(selectedIds); if (ids.length > 0 && ids[0]) window.location.href = `mailto:${customers.find(c => c.id === ids[0])?.email || ''}`; }}>
                      <Mail className="h-3.5 w-3.5" /> Email
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

        {/* ── Customer Table (Desktop / Tablet) ───────────────────────────── */}
        {!loading && !hasNoCustomers && !hasNoResults && !isError && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={paginated.length > 0 && paginated.every(c => selectedIds.has(c.id))}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <div className="flex items-center gap-1">
                        Customer
                        {sortField === 'name' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('company')}>
                      <div className="flex items-center gap-1">
                        Company
                        {sortField === 'company' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                      <div className="flex items-center gap-1">
                        Status
                        {sortField === 'status' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('value')}>
                      <div className="flex items-center justify-end gap-1">
                        Lifetime Value
                        {sortField === 'value' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('updated_at')}>
                      <div className="flex items-center gap-1">
                        Last Activity
                        {sortField === 'updated_at' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-10 text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {paginated.map((customer: Customer, i: number) => {
                      const healthScore = getHealthScore(customer);
                      const custType = getCustomerType(customer);
                      const indicator = getFollowUpIndicator(customer);
                      const daysSince = Math.floor((Date.now() - new Date(customer.updated_at).getTime()) / 86_400_000);
                      const isStale = daysSince > 30;
                      return (
                        <motion.tr
                          key={customer.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02, duration: 0.2 }}
                          className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                          onClick={() => handleCustomerClick(customer)}
                        >
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(customer.id)}
                              onCheckedChange={() => toggleSelect(customer.id)}
                              aria-label={`Select ${customer.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br',
                                getAvatarGradient(customer.name),
                              )}>
                                {getInitials(customer.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium leading-tight">{customer.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {customer.email || customer.phone || 'No contact information'}
                                </p>
                                {indicator && (
                                  <span className={cn('text-[10px] font-medium', indicator.color)}>{indicator.label}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="truncate text-sm">{customer.company || 'Independent'}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{customer.industry || 'No industry specified'}</p>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div><ScoreRing score={healthScore} size={36} /></div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs font-medium">{healthLabel(healthScore)}</p>
                                <p className="text-xs text-muted-foreground">Score: {healthScore}/100</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px]', custType.className)}>
                              {custType.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px] capitalize', statusColors[customer.status])}>
                              {customer.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="text-sm font-semibold font-mono">{formatCurrency(customer.value || 0)}</p>
                            <p className="text-[10px] text-muted-foreground">Customer Value</p>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'text-xs',
                                  isStale ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground',
                                )}>
                                  {formatRelativeDate(customer.updated_at)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {formatExactDate(customer.updated_at)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {customer.email && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.location.href = `mailto:${customer.email}`} aria-label="Email customer">
                                      <Mail className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Send email</TooltipContent>
                                </Tooltip>
                              )}
                              {customer.phone && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.location.href = `tel:${customer.phone}`} aria-label="Call customer">
                                      <Phone className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Call</TooltipContent>
                                </Tooltip>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => router.push(`/customers/${customer.id}`)}>
                                    <User className="h-3.5 w-3.5 mr-2" /> Open
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEdit(customer)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push('/tasks')}>
                                    <CalendarPlus className="h-3.5 w-3.5 mr-2" /> Create Task
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push(`/customers/${customer.id}`)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" /> View Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(customer.id)}>
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

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((customer: Customer, i: number) => {
                const healthScore = getHealthScore(customer);
                const custType = getCustomerType(customer);
                const indicator = getFollowUpIndicator(customer);
                return (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                  >
                    <Card className="rounded-xl border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] cursor-pointer"
                      onClick={() => handleCustomerClick(customer)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br',
                              getAvatarGradient(customer.name),
                            )}>
                              {getInitials(customer.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold leading-tight">{customer.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{customer.company || 'Independent'}</p>
                              {indicator && (
                                <span className={cn('text-[10px] font-medium', indicator.color)}>{indicator.label}</span>
                              )}
                            </div>
                          </div>
                          <ScoreRing score={healthScore} size={38} />
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn('text-[10px]', custType.className)}>{custType.label}</Badge>
                            <Badge variant="outline" className={cn('text-[10px] capitalize', statusColors[customer.status])}>{customer.status}</Badge>
                          </div>
                          <p className="text-sm font-semibold font-mono">{formatCurrency(customer.value || 0)}</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          <span className={cn(
                            'text-[11px]',
                            isStaleDate(customer.updated_at) ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground',
                          )}>
                            {formatRelativeDate(customer.updated_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {customer.email && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${customer.email}`; }} aria-label="Email customer">
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            {customer.phone && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${customer.phone}`; }} aria-label="Call customer">
                                <Phone className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(customer); }} aria-label="Edit customer">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="ml-2">Showing {startIdx}–{endIdx} of {sorted.length} Customers</span>
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
                      <Skeleton className="h-10 w-10 rounded-full" />
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
                    <div className="mt-3 pt-3 border-t border-border">
                      <Skeleton className="h-3 w-20 rounded" />
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
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-32 rounded" />
                        <Skeleton className="h-2.5 w-24 rounded" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-12 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
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
              <DialogTitle>{editingId ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc." /></div>
                <div className="space-y-2"><Label>Industry</Label>
                  <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map((ind) => (<SelectItem key={ind} value={ind}>{ind}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@acme.com" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0100" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Customer['status'] })}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Account Value ($)</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="50000" min="0" /></div>
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || updateCustomer.isPending}>{saving || updateCustomer.isPending ? 'Saving...' : editingId ? 'Update' : 'Add Customer'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Customer?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone. The customer and all associated data will be permanently removed.</p>
            <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="destructive" onClick={handleDelete} disabled={deleteCustomerMutation.isPending}>{deleteCustomerMutation.isPending ? 'Deleting...' : 'Delete'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <CustomerDetailSheet
          customerId={selectedCustomerId}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onUpdated={loadCustomers}
          onDeleted={loadCustomers}
          onEdit={(customer) => { setSheetOpen(false); openEdit(customer); }}
          onDelete={(id) => { setSheetOpen(false); setDeleteId(id); }}
        />
      </div>
    </TooltipProvider>
  );
}

function isStaleDate(dateStr: string): boolean {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000) > 30;
}

// ─── Customer Detail Sheet (preserved with polish) ───────────────────────────

function CustomerDetailSheet({
  customerId,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  onEdit,
  onDelete,
}: {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [aiEmail, setAiEmail] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);

  const { data: customerResponse, isLoading: loadingCustomer } = useCustomer(customerId || '');
  const customer = customerResponse?.data || null;

  const { data: notesResponse } = useNotesByEntity('customer', customerId || '');
  const notes = notesResponse?.data || [];

  const { data: tasksResponse } = useTasksByEntity('customer', customerId || '');
  const tasks = tasksResponse?.data || [];

  const { data: followUpsResponse } = useFollowUpsByEntity('customer', customerId || '');
  const followUps = followUpsResponse?.data || [];

  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const createNote = useCreateNote();

  const loadActivities = useCallback(async () => {
    if (!customerId) return;
    setLoadingActivities(true);
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('entity_type', 'customer')
      .eq('entity_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);
    setActivities((data || []) as Activity[]);
    setLoadingActivities(false);
  }, [customerId]);

  useEffect(() => {
    if (open && customerId) {
      loadActivities();
      if (customer) {
        setForm({
          name: customer.name,
          company: customer.company || '',
          email: customer.email || '',
          phone: customer.phone || '',
          industry: customer.industry || '',
          status: customer.status,
          value: String(customer.value || 0),
        });
      }
      setActiveTab('overview');
      setEditing(false);
    }
  }, [open, customerId, customer, loadActivities]);

  const handleSaveEdit = async () => {
    if (!customer || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      industry: form.industry || null,
      status: form.status,
      value: parseFloat(form.value) || 0,
    };
    updateCustomer.mutate(
      { id: customer.id, data: payload },
      {
        onSuccess: () => {
          setSaving(false);
          setEditing(false);
          onUpdated();
        },
        onError: () => setSaving(false),
      }
    );
  };

  const handleAddNote = async () => {
    if (!customer || !noteContent.trim()) return;
    createNote.mutate(
      { entity_type: 'customer', entity_id: customer.id, content: noteContent.trim() },
      { onSuccess: () => setNoteContent('') }
    );
  };

  const handleGenerateEmail = async () => {
    if (!customer) return;
    setGeneratingEmail(true);
    setAiEmail('');
    try {
      const response = await fetch('/api/ai-email-writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: { name: customer.name, company: customer.company, industry: customer.industry, status: customer.status },
          interactions: activities.slice(0, 5).map(a => ({ summary: a.title, type: a.type })),
          context: 'customer',
        }),
      });
      const data = await response.json();
      setAiEmail(data.email || 'Unable to generate email.');
    } catch {
      setAiEmail(`Hi ${customer.name},\n\nThank you for your continued partnership with ${customer.company || 'your organization'}. I wanted to check in and see how things are progressing.\n\nPlease let me know if there's anything specific I can help you with. I'm always happy to schedule a call to discuss your needs.\n\nBest regards`);
    }
    setGeneratingEmail(false);
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted();
      },
    });
  };

  const handleStatusChange = async (newStatus: Customer['status']) => {
    if (!customer) return;
    updateCustomer.mutate(
      { id: customer.id, data: { status: newStatus } },
      { onSuccess: onUpdated }
    );
  };

  const loading = loadingCustomer || loadingActivities;

  if (!customerId) return null;

  const totalActivities = activities.length;
  const lastContact = activities[0]?.created_at || customer?.created_at || new Date().toISOString();
  const daysSinceContact = customer ? Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const pendingTasks = tasks.filter((t: Task) => t.status !== 'completed').length;
  const totalValue = customer?.value || 0;
  const lifetimeValue = totalValue + (totalActivities * 500);
  const healthScore = customer ? getHealthScore(customer) : 0;
  const custType = customer ? getCustomerType(customer) : { label: '', className: '' };
  const pendingFollowUps = followUps.filter((f: FollowUp) => f.status === 'pending').length;
  const nextFollowUp = followUps.filter((f: FollowUp) => f.status === 'pending').sort((a: FollowUp, b: FollowUp) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const insights: { type: 'success' | 'warning' | 'alert' | 'info'; title: string; desc: string; icon: typeof AlertCircle }[] = [];
  if (customer?.status === 'active' && daysSinceContact > 30) {
    insights.push({ type: 'warning', title: 'No recent contact', desc: `${daysSinceContact} days since last interaction. Consider reaching out.`, icon: AlertCircle });
  }
  if (customer?.status === 'churned') {
    insights.push({ type: 'alert', title: 'Churned customer', desc: 'May be opportunity for win-back campaign.', icon: TrendingUp });
  }
  if (totalValue > 50000 && daysSinceContact < 7) {
    insights.push({ type: 'success', title: 'High-value engagement', desc: 'Premium customer with recent contact.', icon: Star });
  }
  if (pendingTasks > 3) {
    insights.push({ type: 'info', title: 'Outstanding tasks', desc: `${pendingTasks} pending tasks need attention.`, icon: CheckCircle });
  }
  if (customer?.status === 'prospect') {
    insights.push({ type: 'info', title: 'Prospect account', desc: 'Convert to active customer to unlock full potential.', icon: Target });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !customer ? (
          <div className="text-center py-20 text-muted-foreground">Not found</div>
        ) : (
          <>
            <SheetHeader className="space-y-1 pb-4 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white bg-gradient-to-br',
                    getAvatarGradient(customer.name),
                  )}>
                    {getInitials(customer.name)}
                  </div>
                  <div>
                    <SheetTitle className="text-xl">{customer.name}</SheetTitle>
                    {customer.company && (
                      <SheetDescription className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {customer.company}
                      </SheetDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(customer)} aria-label="Edit customer">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(customer.id)} aria-label="Delete customer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="flex items-center gap-2 py-3 border-b flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveTab('email')}>
                <Mail className="h-3.5 w-3.5" />Email
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveTab('history')}>
                <Phone className="h-3.5 w-3.5" />Log Call
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGenerateEmail}>
                <Send className="h-3.5 w-3.5" />AI Draft
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.location.href = `/customers/${customer.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />Full Profile
              </Button>
              <Select value={customer.status} onValueChange={(v) => handleStatusChange(v as Customer['status'])}>
                <SelectTrigger className="h-8 w-auto">
                  <Badge variant="outline" className={cn('capitalize', statusColors[customer.status])}>{customer.status}</Badge>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 py-3 border-b">
              {customer.email && <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs"><Mail className="h-3 w-3 text-muted-foreground" />{customer.email}</div>}
              {customer.phone && <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{customer.phone}</div>}
              {customer.industry && <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs"><Building2 className="h-3 w-3 text-muted-foreground" />{customer.industry}</div>}
              <div className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', custType.className)}>
                {custType.label}
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <DollarSign className="h-3 w-3" />{formatCurrencyFull(customer.value || 0)}
              </div>
            </div>

            {/* Health Score Ring */}
            <div className="py-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Customer Health</span>
                <span className={cn("text-sm font-semibold", healthScore >= 70 ? "text-emerald-600 dark:text-emerald-400" : healthScore >= 40 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                  {healthLabel(healthScore)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                    <circle cx="40" cy="40" r="36" fill="none" stroke={healthColor(healthScore)} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${(healthScore / 100) * 226.2} 226.2`}
                      style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">{healthScore}</div>
                </div>
                <div className="flex-1 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Contact</span><span>{formatRelativeDate(lastContact)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Activities</span><span>{totalActivities}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending Tasks</span><span>{pendingTasks}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Est. Lifetime Value</span><span className="font-medium">{formatCurrencyFull(lifetimeValue)}</span></div>
                  {nextFollowUp && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Next Follow-up</span><span className="font-medium">{formatRelativeDate(nextFollowUp.due_date)}</span></div>
                  )}
                </div>
              </div>
            </div>

            {editing && (
              <Card className="my-4 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                <CardHeader className="pb-3"><CardTitle className="text-base">Edit Customer</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-xs">Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-8" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Industry</Label>
                      <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Customer['status'] })}>
                        <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Value ($)</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-8" /></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
                <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-sky-500" />AI Insights</h4>
                  {insights.length === 0 ? (
                    <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm"><CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />Customer is in good shape. No immediate actions needed.</CardContent></Card>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {insights.map((insight, i) => {
                        const Icon = insight.icon;
                        const colors = { success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950', warning: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950', alert: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950', info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950' };
                        return (
                          <Card key={i} className={cn('border', colors[insight.type])}>
                            <CardContent className="p-3"><div className="flex items-start gap-2"><Icon className="h-4 w-4 mt-0.5 opacity-70" /><div><p className="text-xs font-medium">{insight.title}</p><p className="text-xs text-muted-foreground">{insight.desc}</p></div></div></CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5"><ActivityIcon className="h-4 w-4 text-slate-500" />Recent Activity</h4>
                  {activities.length === 0 ? <p className="text-xs text-muted-foreground">No recent activity.</p> : (
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {activities.slice(0, 5).map((activity) => (
                          <div key={activity.id} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/30">
                            <div className="mt-0.5">
                              {activity.type.includes('created') && <Plus className="h-3 w-3 text-green-600" />}
                              {activity.type.includes('updated') && <Edit className="h-3 w-3 text-blue-600" />}
                              {activity.type.includes('note') && <FileText className="h-3 w-3 text-purple-600" />}
                              {activity.type.includes('interaction') && <MessageSquare className="h-3 w-3 text-amber-600" />}
                            </div>
                            <div className="flex-1"><p>{activity.title}</p><p className="text-muted-foreground">{formatRelativeDate(activity.created_at)}</p></div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{totalActivities}</p><p className="text-xs text-muted-foreground">Activities</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{notes.length}</p><p className="text-xs text-muted-foreground">Notes</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{pendingTasks}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
                </div>

                {pendingFollowUps > 0 && (
                  <Card className="border-border">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-amber-500" />
                        <p className="text-sm font-medium">{pendingFollowUps} pending follow-up{pendingFollowUps > 1 ? 's' : ''}</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <a href="/follow-ups">View Follow-ups <ArrowRight className="h-3 w-3" /></a>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4 mt-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Activity Timeline</h4>
                  {activities.length === 0 ? <p className="text-xs text-muted-foreground">No activities recorded.</p> : (
                    <ScrollArea className="h-80">
                      <div className="space-y-2">
                        {activities.map((act) => (
                          <Card key={act.id} className="border-border">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <Badge variant="outline" className="capitalize text-xs">{act.type.replace('_', ' ')}</Badge>
                                <span className="text-xs text-muted-foreground">{formatRelativeDate(act.created_at)}</span>
                              </div>
                              <p className="text-sm mt-1">{act.title}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <Card className="border-border">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Add Note</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea placeholder="Write your note..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} className="min-h-20" />
                    <Button size="sm" onClick={handleAddNote} disabled={createNote.isPending || !noteContent.trim()}>{createNote.isPending ? 'Adding...' : 'Add Note'}</Button>
                  </CardContent>
                </Card>
                <div>
                  <h4 className="text-sm font-medium mb-2">Notes</h4>
                  {notes.length === 0 ? <p className="text-xs text-muted-foreground">No notes yet.</p> : (
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {notes.map((note: Note) => (
                          <Card key={note.id} className="border-border">
                            <CardContent className="p-3">
                              <p className="text-sm">{note.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">{formatRelativeDate(note.created_at)}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="space-y-4 mt-4">
                <Card className="border-dashed">
                  <CardContent className="py-6 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium">Tasks & Follow-ups</p>
                    <p className="text-xs text-muted-foreground mb-3">{pendingTasks} pending tasks for this customer</p>
                    <Button variant="outline" size="sm" className="gap-1.5" asChild><a href="/tasks">View All Tasks <ArrowRight className="h-3 w-3" /></a></Button>
                  </CardContent>
                </Card>
                {tasks.length > 0 && (
                  <div className="space-y-2">
                    {tasks.slice(0, 5).map((task: Task) => (
                      <Card key={task.id} className="border-border">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", task.status === 'completed' ? "bg-emerald-500" : "bg-amber-500")} />
                            <span className="text-sm">{task.title}</span>
                          </div>
                          {task.due_date && <span className="text-xs text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="email" className="space-y-4 mt-4">
                <Card className="border-border">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" />AI Email Draft</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Button size="sm" onClick={handleGenerateEmail} disabled={generatingEmail}>{generatingEmail ? 'Generating...' : 'Generate Email'}</Button>
                    {aiEmail && (
                      <>
                        <Textarea value={aiEmail} onChange={(e) => setAiEmail(e.target.value)} className="min-h-40" />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(aiEmail); toast.success('Copied to clipboard'); }}><Copy className="h-3 w-3" />Copy</Button>
                          {customer?.email && <Button variant="outline" size="sm" className="gap-1.5" asChild><a href={`mailto:${customer.email}?body=${encodeURIComponent(aiEmail)}`}><ExternalLink className="h-3 w-3" />Open Mail</a></Button>}
                        </div>
                      </>
                    )}
                    {!aiEmail && !generatingEmail && (
                      <div className="text-center py-8 border border-dashed border-border rounded-lg">
                        <Mail className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">Click Generate for AI draft</p>
                      </div>
                    )}
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
