'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, Profile, ScoringWeights } from '@/lib/supabase/client';
import { getScoringWeights, saveScoringWeights } from '@/lib/lead-scoring';
import { logAudit } from '@/lib/activity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, User, Sliders, Save, Users, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'border-violet-200 bg-violet-50 text-violet-700' },
  manager: { label: 'Manager', color: 'border-blue-200 bg-blue-50 text-blue-700' },
  sales_rep: { label: 'Sales Rep', color: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export function SettingsPage() {
  const { profile, session, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Profile['role']>('sales_rep');
  const [savingProfile, setSavingProfile] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [weights, setWeights] = useState<ScoringWeights | null>(null);
  const [savingWeights, setSavingWeights] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; entity_type: string | null; created_at: string; user_id: string | null }>>([]);

  const loadProfileData = useCallback(async () => {
    if (profile) {
      setFullName(profile.full_name || '');
      setRole(profile.role);
    }
    const w = await getScoringWeights();
    setWeights(w);

    const { data: profilesData } = await supabase.from('profiles').select('*');
    setAllProfiles((profilesData || []) as Profile[]);

    if (profile?.role === 'admin') {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('id, action, entity_type, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50);
      setAuditLogs((logs || []) as unknown as typeof auditLogs);
    }
  }, [profile]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, role })
      .eq('user_id', session?.user.id || '');

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
      logAudit({ action: 'profile_updated', entity_type: 'profile', new_values: { full_name: fullName, role } });
      refreshProfile();
    }
    setSavingProfile(false);
  };

  const handleUpdateRole = async (userId: string, newRole: Profile['role']) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId);
    if (error) toast.error('Failed to update role');
    else {
      toast.success('Role updated');
      logAudit({ action: 'role_changed', entity_type: 'profile', entity_id: userId, new_values: { role: newRole } });
      loadProfileData();
    }
  };

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weights) return;
    setSavingWeights(true);
    await saveScoringWeights(weights);
    toast.success('Scoring weights saved');
    logAudit({ action: 'scoring_weights_updated', entity_type: 'scoring_weights', new_values: weights as unknown as Record<string, unknown> });
    setSavingWeights(false);
  };

  const isAdmin = profile?.role === 'admin';

  const weightFields: Array<{ key: keyof ScoringWeights; label: string; description: string }> = [
    { key: 'industry_weight', label: 'Industry Fit', description: 'How much the industry matters' },
    { key: 'company_size_weight', label: 'Company Size', description: 'Weight for company size' },
    { key: 'interaction_count_weight', label: 'Interaction Count', description: 'Number of interactions' },
    { key: 'email_reply_weight', label: 'Email Replies', description: 'Replies received' },
    { key: 'meeting_count_weight', label: 'Meetings Booked', description: 'Meetings scheduled' },
    { key: 'last_contact_weight', label: 'Last Contact Date', description: 'Recency of last contact' },
    { key: 'lead_status_weight', label: 'Lead Status', description: 'Current pipeline stage' },
  ];

  const totalWeight = weights ? Object.values(weights).reduce((sum, w) => sum + w, 0) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, team roles, and AI scoring configuration.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="profile" className="gap-1.5"><User className="h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Team</TabsTrigger>
          <TabsTrigger value="scoring" className="gap-1.5"><Sliders className="h-3.5 w-3.5" /> Scoring</TabsTrigger>
          {isAdmin && <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-3.5 w-3.5" /> Audit Log</TabsTrigger>}
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="mt-4">
          <Card className="max-w-lg border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-lg">Your Profile</CardTitle>
              <CardDescription>Update your name and role.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={session?.user?.email || ''} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Profile['role'])} disabled={!isAdmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="sales_rep">Sales Representative</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isAdmin && <p className="text-xs text-muted-foreground">Only admins can change roles.</p>}
                </div>
                <Button type="submit" disabled={savingProfile} className="gap-2">
                  <Save className="h-4 w-4" />
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="mt-4">
          <Card className="border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-lg">Team Members</CardTitle>
              <CardDescription>Manage roles for your team. {isAdmin ? 'You can assign roles as an admin.' : 'Only admins can change roles.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allProfiles.map((p) => {
                  const roleInfo = roleLabels[p.role];
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold text-slate-700">
                        {(p.full_name || 'U')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{p.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{p.user_id === session?.user?.id ? 'You' : 'Team member'}</p>
                      </div>
                      {isAdmin ? (
                        <Select value={p.role} onValueChange={(v) => handleUpdateRole(p.user_id, v as Profile['role'])}>
                          <SelectTrigger className="w-32">
                            <Badge variant="outline" className={cn('text-xs', roleInfo.color)}>
                              {p.role === 'admin' && <Shield className="mr-1 h-2.5 w-2.5" />}
                              {roleInfo.label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="sales_rep">Sales Rep</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={cn('text-xs', roleInfo.color)}>
                          {p.role === 'admin' && <Shield className="mr-1 h-2.5 w-2.5" />}
                          {roleInfo.label}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {allProfiles.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No team members yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Weights */}
        <TabsContent value="scoring" className="mt-4">
          <Card className="max-w-2xl border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-lg">AI Lead Scoring Weights</CardTitle>
              <CardDescription>
                Configure how much each factor contributes to the lead score (0-100). Weights are normalized automatically.
                Current total: {totalWeight}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weights ? (
                <form onSubmit={handleSaveWeights} className="space-y-4">
                  {weightFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{field.label}</Label>
                        <span className="text-xs text-muted-foreground">{field.description}</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={weights[field.key]}
                        onChange={(e) => setWeights({ ...weights, [field.key]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                  <Button type="submit" disabled={savingWeights} className="gap-2">
                    <Save className="h-4 w-4" />
                    {savingWeights ? 'Saving...' : 'Save Weights'}
                  </Button>
                </form>
              ) : (
                <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log (admin only) */}
        {isAdmin && (
          <TabsContent value="audit" className="mt-4">
            <Card className="border-slate-200/80">
              <CardHeader>
                <CardTitle className="text-lg">Audit Log</CardTitle>
                <CardDescription>Track important actions across the CRM.</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No audit entries yet.</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                          <ScrollText className="h-4 w-4 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</p>
                          {log.entity_type && <p className="text-xs text-muted-foreground">Entity: {log.entity_type}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
