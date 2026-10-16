'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLeadById, useLeadTimeline, useUpdateLead, useDeleteLead, useInteractionsByLeadId, useCreateInteraction } from '@/hooks/useLeads';
import { useNotesByEntity, useCreateNote } from '@/hooks/useNotes';
import { useTasksByEntity, useCreateTask } from '@/hooks/useTasks';
import { useQualifyLead, useDraftEmail } from '@/hooks/useAIActions';
import type { Lead, Task, Note, Interaction, TimelineItem, LeadQualification } from '@/lib/types';
import { useAICommand } from '@/lib/ai-command-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, Building2, User, Calendar, Target, Flame, TrendingUp,
  CheckSquare, Clock, MessageSquare, FileText, Sparkles, Pencil, Trash2,
  ChevronRight, Send, Copy, Plus, ExternalLink, AlertTriangle, Star, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LeadProfilePageProps {
  leadId: string;
}

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;

export function LeadProfilePage({ leadId }: LeadProfilePageProps) {
  const router = useRouter();
  const { openCommandBar } = useAICommand();

  // Data hooks
  const { data: leadData, isLoading: leadLoading } = useLeadById(leadId);
  const { data: timelineData } = useLeadTimeline(leadId);
  const { data: interactionsData } = useInteractionsByLeadId(leadId);
  const { data: notesData } = useNotesByEntity('lead', leadId);
  const { data: tasksData } = useTasksByEntity('lead', leadId);

  // Mutations
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const createInteraction = useCreateInteraction();
  const createNote = useCreateNote();
  const createTask = useCreateTask();
  const qualifyLead = useQualifyLead();
  const draftEmail = useDraftEmail();

  const lead = leadData?.data;
  const timeline = timelineData?.data || [];
  const interactions = interactionsData?.data || [];
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
    title: '',
    status: 'new' as Lead['status'],
  });
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium' as Task['priority'] });
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [qualifications, setQualifications] = useState<LeadQualification | null>(null);

  // Initialize edit form when lead loads
  useEffect(() => {
    if (lead) {
      setEditForm({
        name: lead.name,
        company: lead.company || '',
        email: lead.email || '',
        phone: lead.phone || '',
        title: lead.title || '',
        status: lead.status,
      });
    }
  }, [lead]);

  // Handlers
  const handleUpdateLead = async () => {
    if (!lead) return;
    await updateLead.mutateAsync({ id: lead.id, updates: editForm });
    setEditDialogOpen(false);
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    await deleteLead.mutateAsync(lead.id);
    router.push('/leads');
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await createNote.mutateAsync({ entity_type: 'lead', entity_id: leadId, content: newNote.trim() });
    setNewNote('');
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    await createTask.mutateAsync({
      title: newTask.title.trim(),
      priority: newTask.priority,
      entity_type: 'lead',
      entity_id: leadId,
      status: 'pending',
      description: null,
      due_date: null,
    });
    setNewTask({ title: '', priority: 'medium' });
  };

  const handleQualify = async () => {
    if (!lead) return;
    const res = await qualifyLead.mutateAsync({
      lead,
      interactions,
      notes,
    });
    if (res.data) {
      setQualifications(res.data);
    }
  };

  const handleDraftEmail = async () => {
    if (!lead) return;
    const res = await draftEmail.mutateAsync({
      lead,
      context: `Lead status: ${lead.status}, Score: ${lead.score}/100`,
    });
    if (res.data?.body) {
      setGeneratedEmail(res.data.body);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(generatedEmail);
    toast.success('Email copied to clipboard');
  };

  if (leadLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Target className="h-12 w-12 text-slate-300" />
        <p className="mt-3 text-lg font-medium">Lead not found</p>
        <Button onClick={() => router.push('/leads')} variant="outline" className="mt-4">
          Back to Leads
        </Button>
      </div>
    );
  }

  const tempColors: Record<string, string> = {
    hot: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    warm: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    cold: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  };

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    contacted: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    qualified: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    proposal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    lost: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/leads')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-2xl font-bold text-slate-700 dark:text-slate-200">
              {lead.name[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{lead.name}</h1>
                <Badge className={cn('capitalize', tempColors[lead.temperature])}>
                  {lead.temperature === 'hot' && <Flame className="mr-1 h-3 w-3" />}
                  {lead.temperature}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {lead.company && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{lead.company}</span>}
                {lead.title && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{lead.title}</span>}
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
          <Button onClick={() => openCommandBar(`Draft follow-up to ${lead.name}`)} className="gap-2 bg-gradient-to-r from-sky-500 to-blue-600">
            <Sparkles className="h-4 w-4" />
            AI Assist
          </Button>
        </div>
      </div>

      {/* Key info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <p className={cn(
                  'text-2xl font-bold',
                  (lead.score || 0) >= 70 ? 'text-emerald-600' :
                  (lead.score || 0) >= 40 ? 'text-amber-600' : 'text-slate-400'
                )}>
                  {lead.score || 0}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
                <TrendingUp className="h-6 w-6 text-sky-600" />
              </div>
            </div>
            <Progress value={lead.score || 0} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className={cn('mt-1 capitalize', statusColors[lead.status])}>{lead.status}</Badge>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Target className="h-6 w-6 text-slate-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Last Contact</p>
                <p className="text-sm font-medium mt-1">
                  {lead.last_contacted_at ? formatRelativeDate(lead.last_contacted_at) : 'Never'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <MessageSquare className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-2xl font-bold mt-1">
                  {lead.estimated_value ? `$${(lead.estimated_value / 1000).toFixed(0)}k` : 'N/A'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content with tabs */}
      <Tabs defaultValue="timeline" className="space-y-5">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
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
                          {item.type === 'email' ? <Mail className="h-3.5 w-3.5 text-blue-500" /> :
                           item.type === 'call' ? <Phone className="h-3.5 w-3.5 text-emerald-500" /> :
                           item.type === 'meeting' ? <User className="h-3.5 w-3.5 text-amber-500" /> :
                           item.type === 'task' ? <CheckSquare className="h-3.5 w-3.5 text-violet-500" /> :
                           item.type === 'note' ? <FileText className="h-3.5 w-3.5 text-sky-500" /> :
                           <MessageSquare className="h-3.5 w-3.5 text-slate-400" />}
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

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="space-y-4">
          <Card className="border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Interactions ({interactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-muted-foreground">No interactions logged</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((inter: Interaction, i: number) => (
                    <div key={inter.id} className="flex items-start gap-3 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        inter.type === 'email' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        inter.type === 'call' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        'bg-amber-100 dark:bg-amber-900/30'
                      )}>
                        {inter.type === 'email' ? <Mail className="h-4 w-4 text-blue-600" /> :
                         inter.type === 'call' ? <Phone className="h-4 w-4 text-emerald-600" /> :
                         <User className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">{inter.type}</p>
                        {inter.summary && <p className="text-xs text-muted-foreground mt-0.5">{inter.summary}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatRelativeDate(inter.occurred_at)} · {inter.direction}
                        </p>
                      </div>
                    </div>
                  ))}
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

        {/* AI Insights Tab */}
        <TabsContent value="ai" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Qualify Lead */}
            <Card className="border-slate-200/80 dark:border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Lead Qualification
                </CardTitle>
                <Button size="sm" onClick={handleQualify} disabled={qualifyLead.isPending}>
                  {qualifyLead.isPending ? 'Analyzing...' : 'Run Analysis'}
                </Button>
              </CardHeader>
              <CardContent>
                {!qualifications ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Click "Run Analysis" to qualify this lead using AI
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score</span>
                      <span className="text-lg font-bold">{qualifications.score}/100</span>
                    </div>
                    <p className="text-sm">{qualifications.summary}</p>
                    {qualifications.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Strengths</p>
                        <ul className="space-y-1">
                          {qualifications.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {qualifications.concerns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Concerns</p>
                        <ul className="space-y-1">
                          {qualifications.concerns.map((c, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Next Action</p>
                      <p className="text-sm mt-1">{qualifications.nextAction}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Draft Email */}
            <Card className="border-slate-200/80 dark:border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Draft Follow-up Email
                </CardTitle>
                <Button size="sm" onClick={handleDraftEmail} disabled={draftEmail.isPending}>
                  {draftEmail.isPending ? 'Generating...' : 'Generate'}
                </Button>
              </CardHeader>
              <CardContent>
                {!generatedEmail ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Click "Generate" to create a follow-up email
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                      <pre className="whitespace-pre-wrap text-sm font-sans">{generatedEmail}</pre>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyEmail} className="gap-1.5">
                      <Copy className="h-3.5 w-3.5" />
                      Copy to Clipboard
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
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
                <Label>Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
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
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as Lead['status'] })}>
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
            <Button onClick={handleUpdateLead} disabled={updateLead.isPending}>
              {updateLead.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Lead?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete {lead.name}? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteLead} disabled={deleteLead.isPending}>
              {deleteLead.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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
