'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLeads, useLead, useUpdateLead, useDeleteLead, useDeleteLeads, useLeadInteractions, useCreateInteraction, useExportLeadsCSV } from '@/hooks/useLeads';
import { useNotesByEntity, useCreateNote, useDeleteNote } from '@/hooks/useNotes';
import { useQueryClient } from '@tanstack/react-query';
import { Lead, Interaction, Note } from '@/lib/types';
import { getScoringWeights, computeLeadScore, scoreToTemperature, scoreLabel } from '@/lib/lead-scoring';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
  Plus, Search, Pencil, Trash2, Target, Flame, Mail, Calendar,
  Phone, RefreshCw, Building2, User, ChevronRight, Sparkles,
  Copy, CheckCircle2, Clock, AlertTriangle, Zap, DollarSign, Users,
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, Download, Upload,
  MoreHorizontal, MailOpen, PhoneCall, CalendarPlus, X, TrendingUp,
  CircleDot, Filter, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const INDUSTRIES = ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Consulting', 'Real Estate', 'Media', 'Cybersecurity', 'AI', 'Other'];
const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
const INTERACTION_TYPES = ['email', 'meeting', 'call', 'note', 'demo'] as const;

type LeadForm = {
  name: string; company: string; email: string; phone: string;
  industry: string; company_size: string; title: string; status: Lead['status'];
};

const emptyForm: LeadForm = { name: '', company: '', email: '', phone: '', industry: '', company_size: '', title: '', status: 'new' };

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return 'Never contacted';
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

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 30) return '#f59e0b';
  return '#ef4444';
}

function scoreRingLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Strong';
  if (score >= 30) return 'Fair';
  return 'Needs Attention';
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

// ─── Temperature Badge ───────────────────────────────────────────────────────

const tempConfig: Record<string, { icon: typeof Flame; className: string; emoji: string }> = {
  hot:  { icon: Flame,   className: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300', emoji: '🔥' },
  warm: { icon: CircleDot, className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300', emoji: '🌤' },
  cold: { icon: CircleDot, className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300', emoji: '❄' },
};

const statusConfig: Record<string, string> = {
  new:       'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  contacted: 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  qualified: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  proposal:  'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  won:       'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  lost:      'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

// ─── AI Priority indicator ──────────────────────────────────────────────────

function getAIPriority(lead: Lead): { label: string; color: string } | null {
  if (!lead.last_contacted_at) return { label: 'Never contacted', color: 'text-rose-600 dark:text-rose-400' };
  const daysSince = Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86_400_000);
  if (daysSince > 14) return { label: 'Inactive', color: 'text-amber-600 dark:text-amber-400' };
  if (daysSince > 7) return { label: 'Needs follow-up', color: 'text-orange-600 dark:text-orange-400' };
  if (lead.status === 'proposal') return { label: 'Proposal waiting', color: 'text-amber-600 dark:text-amber-400' };
  if ((lead.score || 0) >= 80) return { label: 'High score', color: 'text-emerald-600 dark:text-emerald-400' };
  if (daysSince <= 2) return { label: 'Recently active', color: 'text-blue-600 dark:text-blue-400' };
  return null;
}

// ─── Saved Views ──────────────────────────────────────────────────────────────

interface SavedView {
  id: string;
  label: string;
  status: string;
  temp: string;
  minScore: number;
}

const SAVED_VIEWS: SavedView[] = [
  { id: 'all',        label: 'All Leads',      status: 'all', temp: 'all', minScore: 0 },
  { id: 'hot',        label: 'Hot Leads',      status: 'all', temp: 'hot', minScore: 0 },
  { id: 'qualified',  label: 'Qualified',      status: 'qualified', temp: 'all', minScore: 0 },
  { id: 'proposal',   label: 'In Proposal',    status: 'proposal', temp: 'all', minScore: 0 },
  { id: 'high-score', label: 'High Score',     status: 'all', temp: 'all', minScore: 70 },
  { id: 'won',        label: 'Won',            status: 'won', temp: 'all', minScore: 0 },
  { id: 'lost',       label: 'Lost',           status: 'lost', temp: 'all', minScore: 0 },
];

// ─── Sort config ─────────────────────────────────────────────────────────────

type SortField = 'name' | 'company' | 'score' | 'temperature' | 'estimated_value' | 'status' | 'last_contacted_at' | 'updated_at';
type SortDir = 'asc' | 'desc';

const sortOptions: { field: SortField; label: string }[] = [
  { field: 'name',             label: 'Lead Name' },
  { field: 'company',          label: 'Company' },
  { field: 'score',            label: 'Score' },
  { field: 'temperature',      label: 'Temperature' },
  { field: 'estimated_value',  label: 'Estimated Value' },
  { field: 'status',           label: 'Status' },
  { field: 'last_contacted_at', label: 'Last Contact' },
  { field: 'updated_at',       label: 'Recently Updated' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tempFilter, setTempFilter] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [activeView, setActiveView] = useState('all');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  // Data
  const { data: leadsResponse, isLoading: loading, refetch: loadLeads, isError } = useLeads();
  const updateLead = useUpdateLead();
  const deleteLeadMutation = useDeleteLead();
  const bulkDeleteLeads = useDeleteLeads();
  const exportMutation = useExportLeadsCSV();

  const leads = useMemo(() => (leadsResponse?.data || []) as Lead[], [leadsResponse]);

  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (leadId && leads.length > 0) setSelectedLeadId(leadId);
  }, [searchParams, leads]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, tempFilter, minScore, activeView]);

  // ── Filtering (memoized) ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return leads.filter((l: Lead) => {
      const matchesSearch = !q ||
        l.name.toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchesTemp = tempFilter === 'all' || l.temperature === tempFilter;
      const matchesScore = minScore === 0 || (l.score || 0) >= minScore;
      return matchesSearch && matchesStatus && matchesTemp && matchesScore;
    });
  }, [leads, debouncedSearch, statusFilter, tempFilter, minScore]);

  // ── Sorting (memoized) ────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: Lead, b: Lead) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'company': cmp = (a.company || '').localeCompare(b.company || ''); break;
        case 'score': cmp = (a.score || 0) - (b.score || 0); break;
        case 'temperature': {
          const order: Record<string, number> = { hot: 3, warm: 2, cold: 1 };
          cmp = (order[a.temperature] || 0) - (order[b.temperature] || 0);
          break;
        }
        case 'estimated_value': cmp = (a.estimated_value || 0) - (b.estimated_value || 0); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'last_contacted_at': {
          const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        case 'updated_at': {
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        }
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
    const activeLeads = leads.filter(l => !['won', 'lost'].includes(l.status));
    const hotLeads = activeLeads.filter(l => l.temperature === 'hot');
    const pipelineValue = activeLeads.reduce((s, l) => s + (l.estimated_value || 0), 0);
    const avgValue = activeLeads.length > 0 ? pipelineValue / activeLeads.length : 0;
    const topLead = [...hotLeads].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const weekAgo = Date.now() - 7 * 86_400_000;
    const activeThisWeek = leads.filter(l => new Date(l.updated_at).getTime() > weekAgo).length;
    const needsFollowUp = activeLeads.filter(l => {
      if (!l.last_contacted_at) return true;
      return (Date.now() - new Date(l.last_contacted_at).getTime()) > 7 * 86_400_000;
    }).length;
    return { activeLeads: activeLeads.length, hotLeads: hotLeads.length, pipelineValue, avgValue, topLead, activeThisWeek, needsFollowUp, total: leads.length };
  }, [leads]);

  // ── AI Insights ────────────────────────────────────────────────────────────

  const aiInsights = useMemo(() => {
    const all: Array<{
      id: string; category: 'Risk' | 'Opportunity' | 'Trend' | 'Recommendation' | 'Summary';
      accentColor: string; title: string; description: string; action: string;
    }> = [];

    if (stats.needsFollowUp > 0) {
      all.push({
        id: 'risk-followup',
        category: 'Risk',
        accentColor: 'border-rose-500',
        title: `${stats.needsFollowUp} lead${stats.needsFollowUp > 1 ? 's' : ''} need follow-up`,
        description: `These leads haven't been contacted in over 7 days. Reach out today to keep them warm and prevent them from going cold.`,
        action: 'View Leads',
      });
    }

    if (stats.hotLeads > 0 && stats.topLead) {
      all.push({
        id: 'opp-hot',
        category: 'Opportunity',
        accentColor: 'border-emerald-500',
        title: `${stats.hotLeads} hot lead${stats.hotLeads > 1 ? 's are' : ' is'} ready to engage`,
        description: `${stats.topLead.name}${stats.topLead.company ? ` at ${stats.topLead.company}` : ''} leads with a score of ${stats.topLead.score ?? 0}. Consider scheduling a proposal or final call.`,
        action: 'Open Lead',
      });
    }

    if (stats.pipelineValue > 0) {
      all.push({
        id: 'trend-pipeline',
        category: 'Trend',
        accentColor: 'border-blue-500',
        title: `Active pipeline valued at ${formatCurrency(stats.pipelineValue)}`,
        description: `Across ${stats.activeLeads} active leads, the average deal size is ${formatCurrency(stats.avgValue)}. Qualified and Proposal stages drive the most value.`,
        action: 'View Pipeline',
      });
    }

    const proposalCount = leads.filter(l => l.status === 'proposal').length;
    if (proposalCount > 0) {
      all.push({
        id: 'rec-proposal',
        category: 'Recommendation',
        accentColor: 'border-amber-500',
        title: `${proposalCount} lead${proposalCount > 1 ? 's are' : ' is'} in the Proposal stage`,
        description: `Proposals awaiting response lose momentum fast. Follow up within 48 hours to maximize close rates.`,
        action: 'Review Proposals',
      });
    }

    if (stats.activeThisWeek > 0) {
      all.push({
        id: 'sum-active',
        category: 'Summary',
        accentColor: 'border-sky-500',
        title: `${stats.activeThisWeek} lead${stats.activeThisWeek > 1 ? 's were' : ' was'} active this week`,
        description: `Your pipeline is moving. Keep the momentum going by logging interactions and scheduling follow-ups for your hottest leads.`,
        action: 'View Activity',
      });
    }

    // Ensure at least 4
    if (all.length < 4) {
      all.push({
        id: 'rec-cadence',
        category: 'Recommendation',
        accentColor: 'border-violet-500',
        title: 'Maintain a consistent outreach cadence',
        description: 'Leads contacted within 24 hours of their last interaction are 60% more likely to convert. Block time daily for outreach.',
        action: 'Create Task',
      });
    }

    return all.filter(i => !Array.from(dismissedInsights).includes(i.id));
  }, [stats, leads, dismissedInsights]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openAdd = useCallback(() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }, []);
  const openEdit = useCallback((lead: Lead) => {
    setEditingId(lead.id);
    setForm({ name: lead.name, company: lead.company || '', email: lead.email || '', phone: lead.phone || '', industry: lead.industry || '', company_size: lead.company_size ? String(lead.company_size) : '', title: lead.title || '', status: lead.status });
    setDialogOpen(true);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      industry: form.industry || null,
      company_size: form.company_size || null,
      title: form.title.trim() || null,
      status: form.status,
    };

    if (editingId) {
      updateLead.mutate({ id: editingId, updates: payload }, { onSuccess: () => { setDialogOpen(false); loadLeads(); } });
    } else {
      const { data, error } = await supabase.from('leads').insert(payload).select().single();
      if (error) toast.error('Failed to create lead');
      else { toast.success('Lead added'); setDialogOpen(false); loadLeads(); }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteLeadMutation.mutate(deleteId, { onSuccess: () => { setDeleteId(null); setSelectedLeadId(null); loadLeads(); } });
  };

  const handleRescore = async (lead: Lead) => {
    setScoring(true);
    const { data: interData } = await supabase.from('interactions').select('*').eq('lead_id', lead.id);
    const inters = (interData || []) as Interaction[];
    const weights = await getScoringWeights();
    const { score, factors } = computeLeadScore(lead, inters, weights);
    const temperature = scoreToTemperature(score);
    updateLead.mutate(
      { id: lead.id, updates: { score, score_factors: factors, temperature } },
      { onSuccess: () => { toast.success(`Score: ${score}/100`); setScoring(false); loadLeads(); }, onError: () => setScoring(false) }
    );
  };

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkDeleteLeads.mutate(ids, { onSuccess: () => { setSelectedIds(new Set()); loadLeads(); } });
  }, [selectedIds, bulkDeleteLeads, loadLeads]);

  const handleExport = useCallback(() => {
    exportMutation.mutate({});
  }, [exportMutation]);

  const applyView = useCallback((view: SavedView) => {
    setActiveView(view.id);
    setStatusFilter(view.status);
    setTempFilter(view.temp);
    setMinScore(view.minScore);
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
    if (paginated.every(l => selectedIds.has(l.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(l => next.add(l.id));
        return next;
      });
    }
  }, [paginated, selectedIds]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setTempFilter('all');
    setMinScore(0);
    setSearch('');
    setActiveView('all');
  }, []);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (tempFilter !== 'all' ? 1 : 0) + (minScore > 0 ? 1 : 0) + (debouncedSearch ? 1 : 0);

  const hasNoLeads = !loading && leads.length === 0;
  const hasNoResults = !loading && leads.length > 0 && sorted.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 p-6 pb-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage, prioritize and convert your sales pipeline.</p>
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
            <Plus className="h-4 w-4" /> New Lead
          </Button>
          <Button variant="outline" onClick={() => router.push('/customers')} className="gap-2">
            <Upload className="h-4 w-4" /> Import Leads
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
              icon={Target}
              iconBg="bg-blue-100 dark:bg-blue-900/40"
              iconColor="text-blue-600 dark:text-blue-400"
              label="Total Leads"
              value={stats.total}
              displayValue={String(stats.total)}
              trend={stats.activeThisWeek > 0 ? { label: `${stats.activeThisWeek} active this week`, positive: true } : null}
              insight={stats.total > 0 ? `${stats.activeLeads} active · ${leads.length - stats.activeLeads} won/lost` : 'No leads yet.'}
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
              insight={stats.hotLeads > 0 ? 'Prioritise outreach within 48h.' : 'No hot leads yet.'}
            />
            <KpiCard
              index={2}
              icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
              iconColor="text-emerald-600 dark:text-emerald-400"
              label="Pipeline Value"
              value={stats.pipelineValue}
              displayValue={formatCurrency(stats.pipelineValue)}
              trend={null}
              insight={stats.pipelineValue > 0 ? `Avg ${formatCurrency(stats.avgValue)} per lead.` : 'No active pipeline.'}
            />
            <KpiCard
              index={3}
              icon={Clock}
              iconBg={stats.needsFollowUp > 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}
              iconColor={stats.needsFollowUp > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
              label="Needs Follow-up"
              value={stats.needsFollowUp}
              displayValue={String(stats.needsFollowUp)}
              trend={null}
              insight={stats.needsFollowUp > 0
                ? `${stats.needsFollowUp} lead${stats.needsFollowUp > 1 ? 's haven\'t' : ' hasn\'t'} been contacted in 7+ days.`
                : 'Everyone has been contacted.'}
            />
          </div>
        )}

        {/* ── AI Insights Panel ──────────────────────────────────────────── */}
        {!loading && aiInsights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-500" />
              <p className="text-sm font-semibold">AI Insights</p>
              <span className="text-[11px] text-muted-foreground">Derived from your pipeline</span>
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
                            if (insight.action === 'Open Lead' && stats.topLead) router.push(`/leads/${stats.topLead.id}`);
                            else if (insight.action === 'View Leads' || insight.action === 'View Pipeline' || insight.action === 'Review Proposals') router.push('/leads');
                            else if (insight.action === 'View Activity') router.push('/activity');
                            else if (insight.action === 'Create Task') router.push('/tasks');
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
        {!loading && leads.length > 0 && (
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
        {!hasNoLeads && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads, companies, emails…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                aria-label="Search leads"
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
                { key: 'hot', label: '🔥 Hot', filter: 'temp' as const },
                { key: 'warm', label: '🌤 Warm', filter: 'temp' as const },
                { key: 'cold', label: '❄ Cold', filter: 'temp' as const },
                { key: 'qualified', label: 'Qualified', filter: 'status' as const },
                { key: 'proposal', label: 'Proposal', filter: 'status' as const },
              ].map(chip => {
                const isActive = chip.filter === 'status'
                  ? statusFilter === chip.key
                  : tempFilter === chip.key;
                const onClick = () => {
                  if (chip.filter === 'status') {
                    setStatusFilter(isActive ? 'all' : chip.key);
                    setActiveView('all');
                  } else {
                    setTempFilter(isActive ? 'all' : chip.key);
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

              {/* New Lead */}
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
            {tempFilter !== 'all' && (
              <Badge variant="outline" className="gap-1 capitalize">
                Temp: {tempFilter}
                <button aria-label="Remove temperature filter" onClick={() => setTempFilter('all')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {minScore > 0 && (
              <Badge variant="outline" className="gap-1">
                Score: {minScore}+
                <button aria-label="Remove score filter" onClick={() => setMinScore(0)}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {debouncedSearch && (
              <Badge variant="outline" className="gap-1">
                Search: "{debouncedSearch}"
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
              <p className="text-sm font-semibold">We couldn't load your leads.</p>
              <p className="text-xs text-muted-foreground mt-1">Something went wrong on our end. Please try again.</p>
              <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => loadLeads()}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Empty onboarding ────────────────────────────────────────────── */}
        {hasNoLeads && !isError && (
          <Card className="rounded-xl border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/20 mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Create your first lead</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Track prospects, monitor opportunities and grow your pipeline from one place.
              </p>
              <div className="flex gap-3 mt-5 flex-wrap justify-center">
                <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Create Lead</Button>
                <Button variant="outline" onClick={() => router.push('/customers')} className="gap-2"><Upload className="h-4 w-4" /> Import CSV</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── No results (filtered) ───────────────────────────────────────── */}
        {hasNoResults && (
          <Card className="rounded-xl border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold">No leads match your filters.</p>
              <p className="text-xs text-muted-foreground mt-1">Try removing one or more filters or broaden your search.</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={clearFilters}>Clear Filters</Button>
                <Button size="sm" onClick={openAdd} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create Lead</Button>
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
                    <span className="text-sm font-medium">{selectedIds.size} Lead{selectedIds.size > 1 ? 's' : ''} Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => router.push('/tasks')}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Assign
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

        {/* ── Lead Table (Desktop / Tablet) ───────────────────────────────── */}
        {!loading && !hasNoLeads && !hasNoResults && !isError && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={paginated.length > 0 && paginated.every(l => selectedIds.has(l.id))}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <div className="flex items-center gap-1">
                        Lead
                        {sortField === 'name' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('company')}>
                      <div className="flex items-center gap-1">
                        Company
                        {sortField === 'company' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('score')}>
                      <div className="flex items-center gap-1">
                        Score
                        {sortField === 'score' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('temperature')}>
                      <div className="flex items-center gap-1">
                        Temp
                        {sortField === 'temperature' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                      <div className="flex items-center gap-1">
                        Status
                        {sortField === 'status' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('estimated_value')}>
                      <div className="flex items-center justify-end gap-1">
                        Value
                        {sortField === 'estimated_value' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('last_contacted_at')}>
                      <div className="flex items-center gap-1">
                        Last Contact
                        {sortField === 'last_contacted_at' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </TableHead>
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
                    {paginated.map((lead: Lead, i: number) => {
                      const tc = tempConfig[lead.temperature] || tempConfig.cold;
                      const priority = getAIPriority(lead);
                      const daysSince = lead.last_contacted_at
                        ? Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86_400_000)
                        : null;
                      const isStale = daysSince !== null && daysSince > 14;
                      return (
                        <motion.tr
                          key={lead.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02, duration: 0.2 }}
                          className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(lead.id)}
                              onCheckedChange={() => toggleSelect(lead.id)}
                              aria-label={`Select ${lead.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br',
                                getAvatarGradient(lead.name),
                              )}>
                                {getInitials(lead.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium leading-tight">{lead.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {lead.email || lead.phone || 'No contact info'}
                                </p>
                                {priority && (
                                  <span className={cn('text-[10px] font-medium', priority.color)}>{priority.label}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="truncate text-sm">{lead.company || 'Independent'}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{lead.industry || 'No industry specified'}</p>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div><ScoreRing score={lead.score || 0} size={36} /></div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs font-medium">{scoreRingLabel(lead.score || 0)}</p>
                                <p className="text-xs text-muted-foreground">Score: {lead.score || 0}/100</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px] capitalize', tc.className)}>
                              {lead.temperature}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px] capitalize', statusConfig[lead.status])}>
                              {lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="text-sm font-semibold font-mono">{formatCurrency(lead.estimated_value || 0)}</p>
                            <p className="text-[10px] text-muted-foreground">Potential</p>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'text-xs',
                                  isStale ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground',
                                  !lead.last_contacted_at && 'text-rose-600 dark:text-rose-400 font-medium',
                                )}>
                                  {formatRelativeDate(lead.last_contacted_at)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {lead.last_contacted_at ? formatExactDate(lead.last_contacted_at) : 'Never contacted'}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground">{formatRelativeDate(lead.updated_at)}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {formatExactDate(lead.updated_at)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {lead.email && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.location.href = `mailto:${lead.email}`} aria-label="Email lead">
                                      <Mail className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Send email</TooltipContent>
                                </Tooltip>
                              )}
                              {lead.phone && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.location.href = `tel:${lead.phone}`} aria-label="Call lead">
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
                                  <DropdownMenuItem onClick={() => setSelectedLeadId(lead.id)}>
                                    <User className="h-3.5 w-3.5 mr-2" /> Open
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEdit(lead)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRescore(lead)}>
                                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Rescore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push('/tasks')}>
                                    <CalendarPlus className="h-3.5 w-3.5 mr-2" /> Create Task
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(lead.id)}>
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
              {paginated.map((lead: Lead, i: number) => {
                const tc = tempConfig[lead.temperature] || tempConfig.cold;
                const priority = getAIPriority(lead);
                return (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                  >
                    <Card className="rounded-xl border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] cursor-pointer"
                      onClick={() => setSelectedLeadId(lead.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br',
                              getAvatarGradient(lead.name),
                            )}>
                              {getInitials(lead.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold leading-tight">{lead.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{lead.company || 'Independent'}</p>
                              {priority && (
                                <span className={cn('text-[10px] font-medium', priority.color)}>{priority.label}</span>
                              )}
                            </div>
                          </div>
                          <ScoreRing score={lead.score || 0} size={38} />
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn('text-[10px] capitalize', tc.className)}>{lead.temperature}</Badge>
                            <Badge variant="outline" className={cn('text-[10px] capitalize', statusConfig[lead.status])}>{lead.status}</Badge>
                          </div>
                          <p className="text-sm font-semibold font-mono">{formatCurrency(lead.estimated_value || 0)}</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          <span className={cn(
                            'text-[11px]',
                            !lead.last_contacted_at ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground',
                          )}>
                            {formatRelativeDate(lead.last_contacted_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {lead.email && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${lead.email}`; }} aria-label="Email lead">
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            {lead.phone && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${lead.phone}`; }} aria-label="Call lead">
                                <Phone className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(lead); }} aria-label="Edit lead">
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
                <span className="ml-2">Showing {startIdx}–{endIdx} of {sorted.length} Leads</span>
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
        )}

        {/* ── Dialogs ────────────────────────────────────────────────────── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Lead' : 'Add Lead'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="TechCorp" /></div>
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VP" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@tech.com" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0100" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Industry</Label><Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{INDUSTRIES.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Company Size</Label><Input type="number" value={form.company_size} onChange={(e) => setForm({ ...form, company_size: e.target.value })} placeholder="500" min="0" /></div>
              </div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Lead['status'] })}><SelectTrigger className="capitalize"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={updateLead.isPending}>{updateLead.isPending ? 'Saving...' : editingId ? 'Update' : 'Add'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Lead?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone. The lead and all associated data will be permanently removed.</p>
            <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="destructive" onClick={handleDelete} disabled={deleteLeadMutation.isPending}>{deleteLeadMutation.isPending ? 'Deleting...' : 'Delete'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <LeadDetailSheet
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onEdit={(lead) => { setSelectedLeadId(null); openEdit(lead); }}
          onDelete={(id) => { setSelectedLeadId(null); setDeleteId(id); }}
          onRescore={handleRescore}
          scoring={scoring}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── Lead Detail Sheet (preserved with polish) ───────────────────────────────

function LeadDetailSheet({ leadId, onClose, onEdit, onDelete, onRescore, scoring }: {
  leadId: string | null; onClose: () => void; onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void; onRescore: (lead: Lead) => void; scoring: boolean;
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [newInteraction, setNewInteraction] = useState({ type: 'email' as Interaction['type'], direction: 'outbound' as Interaction['direction'], subject: '', summary: '', replied: false, meeting_booked: false });
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [newNote, setNewNote] = useState('');

  const { data: leadResponse, isLoading: loadingLead } = useLead(leadId || '');
  const lead = leadResponse?.data || null;
  const { data: interactionsResponse, isLoading: loadingInteractions } = useLeadInteractions(leadId || '');
  const interactions = interactionsResponse?.data || [];
  const { data: notesResponse } = useNotesByEntity('lead', leadId || '');
  const notes = notesResponse?.data || [];

  const createInteraction = useCreateInteraction();
  const createNote = useCreateNote();
  const updateLead = useUpdateLead();

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    createInteraction.mutate({
      lead_id: lead.id, type: newInteraction.type, direction: newInteraction.direction,
      subject: newInteraction.subject || null, summary: newInteraction.summary || null,
      replied: newInteraction.replied, meeting_booked: newInteraction.meeting_booked,
      occurred_at: new Date().toISOString(),
    }, {
      onSuccess: () => {
        setNewInteraction({ type: 'email', direction: 'outbound', subject: '', summary: '', replied: false, meeting_booked: false });
        onRescore(lead);
      }
    });
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !newNote.trim()) return;
    createNote.mutate({ entity_type: 'lead', entity_id: lead.id, content: newNote.trim() }, { onSuccess: () => setNewNote('') });
  };

  const handleGenerateEmail = async () => {
    if (!lead) return;
    setEmailGenerating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-email-writer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ lead, interactions }),
      });
      const data = await res.json();
      setGeneratedEmail(data.email || `Subject: Following up\n\nHi ${lead.name},\n\nI wanted to follow up...\n\nBest regards`);
    } catch { setGeneratedEmail(`Subject: Following up\n\nHi ${lead.name},\n\nI wanted to follow up...\n\nBest regards`); }
    setEmailGenerating(false);
  };

  const updateLeadStatus = async (newStatus: Lead['status']) => {
    if (!lead) return;
    updateLead.mutate({ id: lead.id, updates: { status: newStatus } });
  };

  const loading = loadingLead || loadingInteractions;

  return (
    <Sheet open={!!leadId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : !lead ? (
          <div className="text-center py-20 text-muted-foreground">Not found</div>
        ) : (
          <>
            <div className="pb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white bg-gradient-to-br',
                  getAvatarGradient(lead.name),
                )}>
                  {getInitials(lead.name)}
                </div>
                <div>
                  <SheetTitle className="text-lg">{lead.name}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{lead.title}{lead.company ? ` at ${lead.company}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(lead)} aria-label="Edit lead"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(lead.id)} aria-label="Delete lead"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 py-3 border-b">
              <Button size="sm" className="gap-1.5" onClick={() => setActiveTab('email')}><Mail className="h-3.5 w-3.5" />Email</Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveTab('interactions')}><Phone className="h-3.5 w-3.5" />Log Call</Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleGenerateEmail}><Sparkles className="h-3.5 w-3.5" />AI Draft</Button>
              <div className="ml-auto">
                <Select value={lead.status} onValueChange={(v) => updateLeadStatus(v as Lead['status'])}>
                  <SelectTrigger className="h-8 w-auto border-0 bg-muted"><Badge variant="outline" className="capitalize">{lead.status}</Badge></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 py-3">
              {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm hover:bg-muted"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{lead.email}</a>}
              {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm hover:bg-muted"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{lead.phone}</a>}
              {lead.industry && <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{lead.industry}</span>}
              {lead.company_size && <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm"><Users className="h-3.5 w-3.5 text-muted-foreground" />{lead.company_size} emp</span>}
            </div>

            <Card className="border-border mb-4">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-16 w-16 items-center justify-center">
                      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                        <circle cx="32" cy="32" r="28" fill="none" stroke={scoreColor(lead.score || 0)} strokeWidth="5"
                          strokeDasharray={`${((lead.score || 0) / 100) * 175.9} 175.9`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-xl font-bold">{lead.score || 0}</span>
                        <span className="text-[9px] text-muted-foreground">/100</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('capitalize', tempConfig[lead.temperature]?.className)}>{lead.temperature}</Badge>
                        <span className="text-sm font-medium">{scoreLabel(lead.score || 0)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.last_contacted_at ? `Last: ${formatRelativeDate(lead.last_contacted_at)}` : 'Never contacted'}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onRescore(lead)} disabled={scoring}>
                    <RefreshCw className={cn('h-3.5 w-3.5', scoring && 'animate-spin')} />Rescore
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="interactions" className="text-xs">History ({interactions.length})</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">Notes ({notes.length})</TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
                <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <Card className="border-border">
                  <CardHeader className="py-3 px-4"><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-sky-500" />AI Insights</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {lead.temperature === 'hot' && <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800"><Zap className="h-4 w-4 text-emerald-600 mt-0.5" /><div><p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Ready to close</p><p className="text-xs text-emerald-700 dark:text-emerald-400">Schedule final call or send proposal.</p></div></div>}
                    {lead.temperature === 'cold' && <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800"><AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" /><div><p className="text-sm font-medium text-blue-900 dark:text-blue-200">Needs warming</p><p className="text-xs text-blue-700 dark:text-blue-400">Consider relevant outreach.</p></div></div>}
                    {lead.status === 'proposal' && <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800"><DollarSign className="h-4 w-4 text-amber-600 mt-0.5" /><div><p className="text-sm font-medium text-amber-900 dark:text-amber-200">Proposal stage</p><p className="text-xs text-amber-700 dark:text-amber-400">Follow up within 3 days.</p></div></div>}
                    {!lead.last_contacted_at && <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800"><Clock className="h-4 w-4 text-rose-600 mt-0.5" /><div><p className="text-sm font-medium text-rose-900 dark:text-rose-200">Never contacted</p><p className="text-xs text-rose-700 dark:text-rose-400">Reach out within 5 minutes for best results.</p></div></div>}
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    {interactions.length === 0 ? <div className="text-center py-4 text-xs text-muted-foreground">No activity</div> : (
                      <div className="space-y-2">
                        {interactions.slice(0, 5).map((inter: Interaction) => (
                          <div key={inter.id} className="flex items-center gap-3 py-1.5">
                            <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                              inter.type === 'email' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
                              inter.type === 'meeting' && 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
                              inter.type === 'call' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
                            )}>
                              <Mail className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate capitalize">{inter.type}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(inter.occurred_at).toLocaleDateString()}</p>
                            </div>
                            {inter.replied && <Badge variant="outline" className="text-[10px]">Replied</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="interactions" className="mt-4 space-y-4">
                <Card className="border-border">
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Log Interaction</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <form onSubmit={handleAddInteraction} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={newInteraction.type} onValueChange={(v) => setNewInteraction({ ...newInteraction, type: v as Interaction['type'] })}><SelectTrigger className="capitalize"><SelectValue /></SelectTrigger><SelectContent>{INTERACTION_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
                        <Select value={newInteraction.direction} onValueChange={(v) => setNewInteraction({ ...newInteraction, direction: v as Interaction['direction'] })}><SelectTrigger className="capitalize"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="outbound">Outbound</SelectItem><SelectItem value="inbound">Inbound</SelectItem></SelectContent></Select>
                      </div>
                      <Input value={newInteraction.subject} onChange={(e) => setNewInteraction({ ...newInteraction, subject: e.target.value })} placeholder="Subject" />
                      <Textarea value={newInteraction.summary} onChange={(e) => setNewInteraction({ ...newInteraction, summary: e.target.value })} placeholder="Notes" rows={2} />
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newInteraction.replied} onChange={(e) => setNewInteraction({ ...newInteraction, replied: e.target.checked })} className="rounded" />Reply received</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newInteraction.meeting_booked} onChange={(e) => setNewInteraction({ ...newInteraction, meeting_booked: e.target.checked })} className="rounded" />Meeting booked</label>
                      </div>
                      <Button type="submit" size="sm" className="w-full" disabled={createInteraction.isPending}>{createInteraction.isPending ? 'Saving...' : 'Log'}</Button>
                    </form>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {interactions.map((inter: Interaction) => (
                    <div key={inter.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        inter.type === 'email' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
                        inter.type === 'meeting' && 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
                        inter.type === 'call' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
                      )}>
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium capitalize">{inter.type}</span>{inter.replied && <Badge variant="outline" className="text-[10px]">Replied</Badge>}</div>
                        {inter.subject && <p className="text-sm">{inter.subject}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(inter.occurred_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-4 space-y-4">
                <Card className="border-border">
                  <CardContent className="pt-4">
                    <form onSubmit={handleAddNote} className="space-y-3">
                      <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add note..." rows={3} />
                      <Button type="submit" size="sm" disabled={!newNote.trim() || createNote.isPending}>{createNote.isPending ? 'Saving...' : 'Add Note'}</Button>
                    </form>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {notes.map((note: Note) => (
                    <Card key={note.id} className="border-border">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">{new Date(note.created_at).toLocaleDateString()}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => window.location.href = '/tasks'}><Plus className="h-3.5 w-3.5 mr-1.5" />Create Task</Button>
                </div>
              </TabsContent>

              <TabsContent value="email" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">AI Email Draft</div>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleGenerateEmail} disabled={emailGenerating}>
                    {emailGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Generate
                  </Button>
                </div>
                {generatedEmail && (
                  <>
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => navigator.clipboard.writeText(generatedEmail)}><Copy className="h-3.5 w-3.5" />Copy</Button>
                    </div>
                    <Textarea value={generatedEmail} onChange={(e) => setGeneratedEmail(e.target.value)} rows={10} className="font-mono text-sm" />
                  </>
                )}
                {!generatedEmail && (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg">
                    <Mail className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Click Generate for AI draft</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
