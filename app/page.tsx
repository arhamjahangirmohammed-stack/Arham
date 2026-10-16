'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Network, Mail, Lock, ArrowRight, Sparkles, BarChart3, Users, MessageSquare } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.push('/dashboard');
    }
  }, [session, loading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setSignInLoading(false);
    } else {
      toast.success('Welcome back!');
      router.push('/dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Disable email redirect
        data: {
          full_name: email.split('@')[0], // Default name from email
        },
      },
    });
    if (error) {
      toast.error(error.message);
      setSignUpLoading(false);
    } else if (data.session) {
      // User was auto-confirmed and logged in
      toast.success('Account created! Welcome to Nexus CRM.');
      router.push('/dashboard');
    } else {
      // Email confirmation is enabled - user needs to confirm email
      toast.success('Account created! Check your email to confirm, then sign in.');
      setSignUpLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left panel - branding */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 lg:w-1/2 lg:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(14,165,233,0.1),transparent_50%)]" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-blue-500/30">
            <Network className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-white">Nexus CRM</span>
        </div>

        <div className="relative z-10 mt-16 lg:mt-0">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
            Close more deals with
            <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
              {' '}AI-powered insights
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300 lg:text-lg">
            Manage customers, track leads, and let AI surface your hottest opportunities — all in one elegant workspace.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: Sparkles, title: 'AI Chat Assistant', desc: 'Ask questions in plain English and get instant answers from your data.' },
              { icon: BarChart3, title: 'Intelligent Lead Scoring', desc: 'Automatic scoring based on interactions, replies, and engagement.' },
              { icon: Users, title: 'Unified Customer View', desc: 'Customers, leads, notes, and follow-ups in one place.' },
            ].map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <feature.icon className="h-4 w-4 text-sky-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{feature.title}</p>
                  <p className="text-sm text-slate-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8 text-sm text-slate-500">
          © 2026 Nexus CRM. All rights reserved.
        </div>
      </div>

      {/* Right panel - auth form */}
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-8 lg:p-16">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg">
              <Network className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Nexus CRM</h2>
          </div>

          <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Welcome</CardTitle>
              <CardDescription className="text-base">
                Sign in to your account or create a new one to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-6">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={signInLoading}>
                      {signInLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Signing in...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Sign In
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="At least 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={signUpLoading}>
                      {signUpLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Creating account...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Create Account
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                <MessageSquare className="mr-1 inline h-3.5 w-3.5" />
                Need help? Contact supportnexuscrm@gmail.com
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
