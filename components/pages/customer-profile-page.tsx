'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerById, useCustomerTimeline, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useCustomers';
import { useNotesByEntity, useCreateNote } from '@/hooks/useNotes';
import { useTasksByEntity, useCreateTask } from '@/hooks/useTasks';
import { useAICommand } from '@/lib/ai-command-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, Building2, User, DollarSign, TrendingUp,
  CheckSquare, MessageSquare, FileText, Sparkles, Pencil, Trash2,
  ChevronRight, Plus, AlertTriangle, Star, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { Customer, Task, Note, TimelineItem, CustomerHealth } from '@/lib/types';

interface CustomerProfilePageProps {
  customerId: string;
}

const STATUSES = ['active', 'inactive', 'prospect', 'churned'] as const;

export function CustomerProfilePage({ customerId }: CustomerProfilePageProps) {
  const router = useRouter();
  const { openCommandBar } = useAICommand();

  // Data hooks
  const { data: customerData, isLoading: customerLoading } = useCustomerById(customerId);
  const { data: timelineData } = useCustomerTimeline(customerId);
  const { data: notesData } = useNotesByEntity('customer', customerId);
  const { data: tasksData } = useTasksByEntity('customer', customerId);

  // Mutations
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const createNote = useCreateNote();
  const createTask = useCreateTask();

  const customer = customerData?.data;
  const timeline = timelineData?.data || [];
  const notes = notesData?.data || [];
  const tasks = tasksData?.data || [];

  // Local state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'active' as Customer['status'],
    value: 0,
  });
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium' as Task['priority'] });

  // Calculate health score
  const health: CustomerHealth | null = customer
    ? calculateCustomerHealth(customer, timeline)
    : null;

  // Initialize edit form when customer loads
  useEffect(() => {
    if (customer) {
      setEditForm({
        name: customer.name,
        company: customer.company || '',
        email: customer.email || '',
        phone: customer.phone || '',
        status: customer.status,
        value: customer.value || 0,
      });
    }
  }, [customer]);

  // Handlers
  const handleUpdateCustomer = async () => {
    if (!customer) return;
    await updateCustomer.mutateAsync({ id: customer.id, data: editForm });
    setEditDialogOpen(false);
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    await deleteCustomer.mutateAsync(customer.id);
    router.push('/customers');
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await createNote.mutateAsync({ entity_type: 'customer', entity_id: customerId, content: newNote.trim() });
    setNewNote('');
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    await createTask.mutateAsync({
      title: newTask.title.trim(),
      priority: newTask.priority,
      entity_type: 'customer',
      entity_id: customerId,
      status: 'pending',
      description: null,
      due_date: null,
    });
    setNewTask({ title: '', priority: 'medium' });
  };

  if (customerLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <User className="h-12 w-12 text-slate-300" />
        <p className="mt-3 text-lg font-medium">Customer not found</p>
        <Button onClick={() => router.push('/customers')} variant="outline" className="mt-4">
          Back to Customers
        </Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    inactive: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    prospect: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    churned: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/customers')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-2xl font-bold text-slate-700 dark:text-slate-200">
              {customer.name[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                <Badge className={cn('capitalize', statusColors[customer.status])}>
                  {customer.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {customer.company && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{customer.company}</span>}
                {customer.industry && <span className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">{customer.industry}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={() => openCommandBar(`Analyze customer ${customer.name}`)} className="gap-2 bg-gradient-to-r from-sky-500 to-blue-600">
            <Sparkles className="h-4 w-4" />
            AI Assist
          </Button>
        </div>
      </div>

      {/* Key info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Health Score */}
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Health Score</p>
                <p className={cn(
                  'text-2xl font-bold',
                  health && health.score >= 80 ? 'text-emerald-600' :
                  health && health.score >= 60 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {health?.score || 0}
                </p>
              </div>
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl',
                health && health.score >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                health && health.score >= 60 ? 'bg-amber-100 dark:bg-amber-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              )}>
                <Activity className={cn(
                  'h-6 w-6',
                  health && health.score >= 80 ? 'text-emerald-600' :
                  health && health.score >= 60 ? 'text-amber-600' : 'text-red-600'
                )} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{health?.summary}</p>
          </CardContent>
        </Card>

        {/* Value */}
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Account Value</p>
                <p className="text-2xl font-bold mt-1">
                  {customer.value ? `$${(customer.value / 1000).toFixed(0)}k` : 'N/A'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Engagement */}
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Last Engagement</p>
                <p className="text-sm font-medium mt-1">
                  {timeline[0] ? formatRelativeDate(timeline[0].occurred_at) : 'Never'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
                <p className="text-2xl font-bold mt-1">
                  {tasks.filter((t: Task) => t.status !== 'completed').length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <CheckSquare className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Risk Alert */}
      {health && health.churnRisk === 'high' && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">At Risk of Churn</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {health.recommendations[0] || 'Consider reaching out to re-engage this customer.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content with tabs */}
      <Tabs defaultValue="timeline" className="space-y-5">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card className="border-slate-200/80 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="space-y-4">
                    {timeline.slice(0, 10).map((item: TimelineItem, i: number) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative flex gap-4 pl-10"
                      >
                        <div className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          {item.type === 'task' ? <CheckSquare className="h-3.5 w-3.5 text-violet-500" /> :
                           item.type === 'note' ? <FileText className="h-3.5 w-3.5 text-sky-500" /> :
                           item.type === 'follow_up' ? <MessageSquare className="h-3.5 w-3.5 text-amber-500" /> :
                           <Activity className="h-3.5 w-3.5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatRelativeDate(item.occurred_at)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card className="border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasks.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckSquare className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-muted-foreground">No tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task: Task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                      <div className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                        task.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                        task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      )}>
                        <CheckSquare className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', task.status === 'completed' && 'line-through text-muted-foreground')}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {task.status} · {task.priority}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add task */}
              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Input
                  placeholder="Add task..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="flex-1"
                />
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as Task['priority'] })}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddTask} disabled={!newTask.title.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <Card className="border-slate-200/80 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Notes ({notes.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notes.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-muted-foreground">No notes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note: Note) => (
                    <div key={note.id} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                      <p className="text-sm">{note.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {formatRelativeDate(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add note */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card className="border-slate-200/80 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Customer Insights</CardTitle>
            </CardHeader>
            <CardContent>
              {health && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <p className="text-xs text-muted-foreground">Trend</p>
                      <p className={cn(
                        'text-sm font-medium capitalize mt-0.5',
                        health.trend === 'improving' && 'text-emerald-600',
                        health.trend === 'stable' && 'text-blue-600',
                        health.trend === 'declining' && 'text-red-600'
                      )}>
                        {health.trend}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <p className="text-xs text-muted-foreground">Churn Risk</p>
                      <p className={cn(
                        'text-sm font-medium capitalize mt-0.5',
                        health.churnRisk === 'low' && 'text-emerald-600',
                        health.churnRisk === 'medium' && 'text-amber-600',
                        health.churnRisk === 'high' && 'text-red-600'
                      )}>
                        {health.churnRisk}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <p className="text-xs text-muted-foreground">Last Engagement</p>
                      <p className="text-sm font-medium mt-0.5">
                        {formatRelativeDate(health.lastEngagement || new Date().toISOString())}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations</p>
                    <ul className="space-y-1.5">
                      {health.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 mt-0.5 text-sky-500 shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Account Value ($)</Label>
                <Input type="number" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as Customer['status'] })}>
                <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateCustomer} disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Customer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete {customer.name}? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCustomer} disabled={deleteCustomer.isPending}>
              {deleteCustomer.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function calculateCustomerHealth(customer: Customer, timeline: TimelineItem[]): CustomerHealth {
  const now = new Date();
  const lastActivity = timeline[0]?.occurred_at || customer.created_at;
  const daysSinceContact = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

  let score = 100;

  if (daysSinceContact > 60) score -= 40;
  else if (daysSinceContact > 30) score -= 25;
  else if (daysSinceContact > 14) score -= 10;

  if (customer.status === 'churned') score = Math.min(score, 20);
  else if (customer.status === 'inactive') score = Math.min(score, 40);
  else if (customer.status === 'prospect') score = Math.min(score, 70);

  if ((customer.value || 0) > 50000) score += 10;

  score = Math.max(0, Math.min(100, score));

  let churnRisk: 'low' | 'medium' | 'high';
  if (score < 40 || customer.status === 'churned') churnRisk = 'high';
  else if (score < 70) churnRisk = 'medium';
  else churnRisk = 'low';

  let trend: 'improving' | 'stable' | 'declining';
  if (daysSinceContact < 7) trend = 'improving';
  else if (daysSinceContact > 21) trend = 'declining';
  else trend = 'stable';

  const recommendations: string[] = [];
  if (daysSinceContact > 30) recommendations.push('Schedule a check-in call soon');
  if (customer.status === 'prospect') recommendations.push('Convert to active customer to increase engagement');
  if (churnRisk === 'high') recommendations.push('Consider a win-back campaign');
  if (recommendations.length === 0) recommendations.push('Continue current engagement strategy');

  return {
    score,
    trend,
    churnRisk,
    lastEngagement: lastActivity,
    summary: score >= 80 ? 'Healthy customer relationship' :
             score >= 60 ? 'Relationship needs attention' :
             'At risk of churn',
    recommendations,
  };
}

function formatRelativeDate(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
