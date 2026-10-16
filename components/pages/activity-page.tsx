'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Lead, Customer, Profile } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { useLeads } from '@/hooks/useLeads';
import { useCustomers } from '@/hooks/useCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Activity as ActivityIcon, Search, StickyNote, Target, Users, CheckSquare, Mail, Calendar, TrendingUp, Sparkles, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

const activityConfig: Record<string, { icon: typeof ActivityIcon; color: string; bg: string; label: string }> = {
  note_added: { icon: StickyNote, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Note Added' },
  lead_created: { icon: Target, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Lead Created' },
  lead_updated: { icon: Target, color: 'text-cyan-600', bg: 'bg-cyan-100', label: 'Lead Updated' },
  lead_status_changed: { icon: Target, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Status Changed' },
  customer_created: { icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Customer Created' },
  customer_updated: { icon: Users, color: 'text-teal-600', bg: 'bg-teal-100', label: 'Customer Updated' },
  interaction_logged: { icon: Phone, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Interaction Logged' },
  task_created: { icon: CheckSquare, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Task Created' },
  task_completed: { icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Task Completed' },
  task_assigned: { icon: CheckSquare, color: 'text-cyan-600', bg: 'bg-cyan-100', label: 'Task Assigned' },
  follow_up_scheduled: { icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Follow-up Scheduled' },
  follow_up_completed: { icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Follow-up Completed' },
  email_sent: { icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Email Sent' },
  email_generated: { icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-100', label: 'AI Email Generated' },
  meeting_scheduled: { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Meeting Scheduled' },
  score_updated: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Score Updated' },
  ai_query: { icon: Sparkles, color: 'text-sky-600', bg: 'bg-sky-100', label: 'AI Query' },
};

export function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: leadsResponse, isLoading: loadingLeads } = useLeads();
  const leads = (leadsResponse?.data || []) as Lead[];

  const { data: customersResponse, isLoading: loadingCustomers } = useCustomers();
  const customers = (customersResponse?.data || []) as Customer[];

  const loadActivities = useCallback(async () => {
    setLoadingActivities(true);
    const [actRes, profilesRes] = await Promise.all([
      supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('*'),
    ]);

    setActivities((actRes.data || []) as Activity[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setLoadingActivities(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const getEntityName = (type: string | null, id: string | null) => {
    if (!type || !id) return null;
    if (type === 'lead') {
      const lead = leads.find((l: Lead) => l.id === id);
      return lead ? `${lead.name}${lead.company ? ` · ${lead.company}` : ''}` : null;
    }
    if (type === 'customer') {
      const customer = customers.find((c: Customer) => c.id === id);
      return customer ? `${customer.name}${customer.company ? ` · ${customer.company}` : ''}` : null;
    }
    return null;
  };

  const getUserName = (userId: string) => {
    const profile = profiles.find((p: Profile) => p.user_id === userId);
    return profile?.full_name || 'Unknown';
  };

  const now = new Date();
  const filtered = activities.filter((a: Activity) => {
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || a.type === typeFilter;
    const matchesEntity = entityFilter === 'all' || a.entity_type === entityFilter;

    let matchesDate = true;
    if (dateFilter !== 'all' && a.created_at) {
      const activityDate = new Date(a.created_at);
      const daysDiff = Math.floor((now.getTime() - activityDate.getTime()) / 86400000);
      if (dateFilter === 'today') matchesDate = daysDiff < 1;
      else if (dateFilter === 'week') matchesDate = daysDiff < 7;
      else if (dateFilter === 'month') matchesDate = daysDiff < 30;
    }

    return matchesSearch && matchesType && matchesEntity && matchesDate;
  });

  const grouped: Record<string, Activity[]> = {};
  filtered.forEach((a: Activity) => {
    const dateKey = new Date(a.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(a);
  });

  const loading = loadingActivities || loadingLeads || loadingCustomers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Activity Timeline</h1>
        <p className="text-sm text-muted-foreground">A chronological log of all interactions, changes, and events across your CRM.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search activities..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(activityConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="follow_up">Follow-ups</SelectItem>
            <SelectItem value="interaction">Interactions</SelectItem>
            <SelectItem value="none">General</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Past Week</SelectItem>
            <SelectItem value="month">Past Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-slate-200/80">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ActivityIcon className="h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-medium">No activities found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters or create some CRM activity.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateKey, dateActivities]) => (
            <div key={dateKey}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dateKey}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="space-y-2">
                {dateActivities.map((activity: Activity) => {
                  const config = activityConfig[activity.type] || activityConfig.note_added;
                  const entityName = getEntityName(activity.entity_type, activity.entity_id);
                  return (
                    <Card key={activity.id} className="border-slate-200/80 transition-colors hover:bg-slate-50/50">
                      <CardContent className="flex items-start gap-3 pt-3.5">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', config.bg)}>
                          <config.icon className={cn('h-4 w-4', config.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{activity.title}</p>
                              {activity.description && <p className="text-xs text-muted-foreground">{activity.description}</p>}
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs">{config.label}</Badge>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(activity.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                            {entityName && (<><span>·</span><span className="font-medium">{entityName}</span></>)}
                            <span>·</span>
                            <span>{getUserName(activity.user_id)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
