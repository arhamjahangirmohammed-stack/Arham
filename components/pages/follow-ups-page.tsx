'use client';

import { useState } from 'react';
import { useFollowUps, useCreateFollowUp, useUpdateFollowUp, useDeleteFollowUp, useCompleteFollowUp } from '@/hooks/useFollowUps';
import { useLeads } from '@/hooks/useLeads';
import { useCustomers } from '@/hooks/useCustomers';
import { useNotesByEntity, useCreateNote, useDeleteNote } from '@/hooks/useNotes';
import { FollowUp, Lead, Customer, Note, EntityType } from '@/lib/types';
import { logActivity } from '@/lib/activity';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Clock, CheckCircle2, XCircle, Calendar, StickyNote, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FollowUpForm = {
  title: string;
  description: string;
  entity_type: 'lead' | 'customer';
  entity_id: string;
  due_date: string;
};

export function FollowUpsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FollowUpForm>({
    title: '',
    description: '',
    entity_type: 'lead',
    entity_id: '',
    due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  });
  const [noteContent, setNoteContent] = useState('');
  const [noteEntityType, setNoteEntityType] = useState<'lead' | 'customer'>('lead');
  const [noteEntityId, setNoteEntityId] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const { data: followUpsResponse, isLoading: loadingFollowUps } = useFollowUps();
  const followUps = (followUpsResponse?.data || []) as FollowUp[];

  const { data: leadsResponse, isLoading: loadingLeads } = useLeads();
  const leads = (leadsResponse?.data || []) as Lead[];

  const { data: customersResponse, isLoading: loadingCustomers } = useCustomers();
  const customers = (customersResponse?.data || []) as Customer[];

  const { data: notesResponse } = useNotesByEntity(noteEntityType as EntityType, noteEntityId);
  const notes = notesResponse?.data || [];

  const createFollowUpHook = useCreateFollowUp();
  const updateFollowUpHook = useUpdateFollowUp();
  const deleteFollowUpHook = useDeleteFollowUp();
  const completeFollowUpHook = useCompleteFollowUp();
  const createNoteHook = useCreateNote();
  const deleteNoteHook = useDeleteNote();

  const loading = loadingFollowUps || loadingLeads || loadingCustomers;

  const getEntityName = (type: string, id: string) => {
    if (type === 'lead') {
      const lead = leads.find((l: Lead) => l.id === id);
      return lead ? `${lead.name}${lead.company ? ` · ${lead.company}` : ''}` : 'Unknown Lead';
    }
    const customer = customers.find((c: Customer) => c.id === id);
    return customer ? `${customer.name}${customer.company ? ` · ${customer.company}` : ''}` : 'Unknown Customer';
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.entity_id) {
      toast.error('Title and associated contact are required');
      return;
    }
    createFollowUpHook.mutate({
      entityType: form.entity_type,
      entityId: form.entity_id,
      title: form.title.trim(),
      dueDate: new Date(form.due_date).toISOString(),
      description: form.description.trim() || null,
    }, {
      onSuccess: () => {
        logActivity({ type: 'follow_up_scheduled', entity_type: form.entity_type, entity_id: form.entity_id, title: `Follow-up scheduled: ${form.title}`, metadata: { due_date: form.due_date } });
        setDialogOpen(false);
        setForm({ title: '', description: '', entity_type: 'lead', entity_id: '', due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16) });
      }
    });
  };

  const updateStatus = (id: string, status: FollowUp['status']) => {
    if (status === 'completed') {
      completeFollowUpHook.mutate(id, {
        onSuccess: () => {
          logActivity({ type: 'follow_up_completed', entity_type: 'follow_up', entity_id: id, title: 'Follow-up completed' });
        }
      });
    } else {
      updateFollowUpHook.mutate({ id, updates: { status } });
    }
  };

  const handleDelete = (id: string) => {
    deleteFollowUpHook.mutate(id);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !noteEntityId) {
      toast.error('Note content and associated contact are required');
      return;
    }
    createNoteHook.mutate({ entity_type: noteEntityType, entity_id: noteEntityId, content: noteContent.trim() }, {
      onSuccess: () => {
        logActivity({ type: 'note_added', entity_type: noteEntityType, entity_id: noteEntityId, title: `Note added: ${noteContent.substring(0, 50)}...` });
        setNoteContent('');
      }
    });
  };

  const handleDeleteNote = (id: string) => {
    deleteNoteHook.mutate({ id, entityType: noteEntityType, entityId: noteEntityId });
  };

  const now = new Date();
  const pending = followUps.filter((f: FollowUp) => f.status === 'pending');
  const overdue = pending.filter((f: FollowUp) => new Date(f.due_date) < now);
  const completed = followUps.filter((f: FollowUp) => f.status === 'completed');
  const cancelled = followUps.filter((f: FollowUp) => f.status === 'cancelled');

  const entityOptions = noteEntityType === 'lead' ? leads : customers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Notes & Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Stay on top of your tasks and keep notes on every contact.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-gradient-to-r from-sky-500 to-blue-600 shadow-md shadow-blue-500/20">
          <Plus className="h-4 w-4" />Schedule Follow-up
        </Button>
      </div>

      {overdue.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm font-medium text-red-900">{overdue.length} overdue follow-up{overdue.length > 1 ? 's' : ''} — take action now.</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="pending" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Done ({completed.length})</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5"><StickyNote className="h-3.5 w-3.5" />Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-1.5"><XCircle className="h-3.5 w-3.5" />Cancelled ({cancelled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)
          ) : pending.length === 0 ? (
            <Card className="border-slate-200/80">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground">No pending follow-ups right now.</p>
              </CardContent>
            </Card>
          ) : (
            pending.map((fu: FollowUp) => {
              const isOverdue = new Date(fu.due_date) < now;
              return (
                <Card key={fu.id} className={cn('border-slate-200/80 transition-all', isOverdue && 'border-red-200 bg-red-50/30')}>
                  <CardContent className="flex items-start gap-3 pt-4">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', isOverdue ? 'bg-red-100' : 'bg-blue-100')}>
                      <Calendar className={cn('h-5 w-5', isOverdue ? 'text-red-600' : 'text-blue-600')} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{fu.title}</p>
                          <p className="text-xs text-muted-foreground">{getEntityName(fu.entity_type, fu.entity_id)}</p>
                          {fu.description && <p className="mt-1 text-sm text-muted-foreground">{fu.description}</p>}
                        </div>
                        <Badge variant="outline" className={cn('shrink-0', isOverdue ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700')}>
                          {isOverdue ? 'Overdue' : 'Due'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(fu.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-emerald-600 hover:bg-emerald-50" onClick={() => updateStatus(fu.id, 'completed')}><CheckCircle2 className="h-3.5 w-3.5" />Complete</Button>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:bg-slate-100" onClick={() => updateStatus(fu.id, 'cancelled')}><XCircle className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(fu.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {completed.length === 0 ? (
            <Card className="border-slate-200/80">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm text-muted-foreground">No completed follow-ups yet.</p>
              </CardContent>
            </Card>
          ) : (
            completed.map((fu: FollowUp) => (
              <Card key={fu.id} className="border-slate-200/80 opacity-70">
                <CardContent className="flex items-start gap-3 pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-through">{fu.title}</p>
                    <p className="text-xs text-muted-foreground">{getEntityName(fu.entity_type, fu.entity_id)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(fu.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card className="border-slate-200/80">
            <CardContent className="pt-5">
              <form onSubmit={handleAddNote} className="space-y-3">
                <div className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Add a Note</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={noteEntityType} onValueChange={(v) => { setNoteEntityType(v as 'lead' | 'customer'); setNoteEntityId(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="lead">For a Lead</SelectItem><SelectItem value="customer">For a Customer</SelectItem></SelectContent>
                  </Select>
                  <Select value={noteEntityId} onValueChange={setNoteEntityId}>
                    <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>
                      {entityOptions.map((entity: Lead | Customer) => (<SelectItem key={entity.id} value={entity.id}>{entity.name}{entity.company ? ` · ${entity.company}` : ''}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write your note here..." rows={3} />
                <Button type="submit" size="sm" className="gap-2" disabled={createNoteHook.isPending || !noteContent.trim() || !noteEntityId}><Plus className="h-3.5 w-3.5" />{createNoteHook.isPending ? 'Adding...' : 'Add Note'}</Button>
              </form>
            </CardContent>
          </Card>

          {notes.length === 0 ? (
            <Card className="border-slate-200/80">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <StickyNote className="h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm text-muted-foreground">No notes yet. Add one above.</p>
              </CardContent>
            </Card>
          ) : (
            notes.map((note: Note) => (
              <Card key={note.id} className="border-slate-200/80">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Badge variant="outline" className="mb-2 capitalize text-xs">{note.entity_type} · {getEntityName(note.entity_type, note.entity_id)}</Badge>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteNote(note.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4 space-y-3">
          {cancelled.length === 0 ? (
            <Card className="border-slate-200/80">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <XCircle className="h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm text-muted-foreground">No cancelled follow-ups.</p>
              </CardContent>
            </Card>
          ) : (
            cancelled.map((fu: FollowUp) => (
              <Card key={fu.id} className="border-slate-200/80 opacity-60">
                <CardContent className="flex items-start gap-3 pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100"><XCircle className="h-5 w-5 text-slate-500" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-through">{fu.title}</p>
                    <p className="text-xs text-muted-foreground">{getEntityName(fu.entity_type, fu.entity_id)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(fu.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Schedule Follow-up</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Call back about pricing" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>For</Label>
                <Select value={form.entity_type} onValueChange={(v) => { setForm({ ...form, entity_type: v as 'lead' | 'customer', entity_id: '' }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="lead">A Lead</SelectItem><SelectItem value="customer">A Customer</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Contact *</Label>
                <Select value={form.entity_id} onValueChange={(v) => setForm({ ...form, entity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {(form.entity_type === 'lead' ? leads : customers).map((entity: Lead | Customer) => (<SelectItem key={entity.id} value={entity.id}>{entity.name}{entity.company ? ` · ${entity.company}` : ''}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Due Date & Time *</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs to be done?" rows={3} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createFollowUpHook.isPending}>{createFollowUpHook.isPending ? 'Saving...' : 'Schedule'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
