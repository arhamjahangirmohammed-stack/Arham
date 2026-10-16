'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useAICommand } from '@/lib/ai-command-context';
import { useOverdueTasks } from '@/hooks/useTasks';
import { useLeads } from '@/hooks/useLeads';
import { useGlobalShortcuts, SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Network, LayoutDashboard, Users, Target, CheckSquare, Activity, Sparkles, LogOut, Menu, X, Shield, Search, Sun, Moon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { AICommandBar } from '@/components/ai-command-bar';
import type { Lead } from '@/lib/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'D' },
  { href: '/customers', label: 'Customers', icon: Users, shortcut: 'C' },
  { href: '/leads', label: 'Leads', icon: Target, shortcut: 'L' },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare, shortcut: 'T' },
  { href: '/activity', label: 'Activity', icon: Activity, shortcut: 'A' },
  { href: '/ai-chat', label: 'AI Chat', icon: Sparkles, shortcut: 'I' },
];

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300' },
  manager: { label: 'Manager', color: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  sales_rep: { label: 'Sales Rep', color: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' },
};

const pageNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/leads': 'Leads',
  '/tasks': 'Tasks',
  '/activity': 'Activity',
  '/ai-chat': 'AI Chat',
  '/settings': 'Settings',
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, loading, signOut } = useAuth();
  const { openCommandBar, isAIThinking, currentAIOperation } = useAICommand();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fetch data for badges
  const { data: overdueTasks } = useOverdueTasks();
  const { data: leadsData } = useLeads();
  const hotLeadsCount = leadsData?.data?.filter((l: Lead) => l.temperature === 'hot' && !['won', 'lost'].includes(l.status)).length || 0;
  const overdueCount = overdueTasks?.data?.length || 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      router.push('/');
    }
  }, [session, loading, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Global keyboard shortcuts
  useGlobalShortcuts([
    { ...SHORTCUTS.openCommandPalette, callback: () => router.push('/dashboard?search=true') },
    { ...SHORTCUTS.openAICommandBar, callback: () => openCommandBar() },
  ]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 animate-ping rounded-full bg-sky-400/20" />
            <div className="relative h-12 w-12 animate-spin rounded-full border-3 border-sky-500 border-t-transparent" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const roleInfo = profile ? roleLabels[profile.role] : roleLabels.sales_rep;
  const displayName = profile?.full_name || session.user.email?.split('@')[0] || 'User';

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/30">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900/90 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/25 transition-transform duration-200 group-hover:scale-105">
              <Network className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Nexus CRM</span>
          </Link>
          <button
            className="rounded-md p-1.5 text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ask AI Button */}
        <div className="px-3 py-3">
          <button
            onClick={() => openCommandBar()}
            className="flex w-full items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-sky-500/25 transition-all hover:brightness-110 hover:shadow-lg hover:shadow-sky-500/35"
          >
            <Sparkles className={cn('h-4 w-4', isAIThinking && 'animate-pulse')} />
            <span>{isAIThinking ? currentAIOperation : 'Ask AI...'}</span>
          </button>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">⌘⇧K</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {navItems.slice(0, -1).map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const isTasks = item.href === '/tasks';
            const isLeads = item.href === '/leads';

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-sky-500/15 to-blue-500/10 text-primary dark:from-sky-500/20 dark:to-blue-500/15 border-l-2 border-primary pl-[10px]'
                      : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground'
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    isActive
                      ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-foreground'
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  {isTasks && overdueCount > 0 && (
                    <Badge className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5">
                      {overdueCount}
                    </Badge>
                  )}
                  {isLeads && hotLeadsCount > 0 && (
                    <Badge className="ml-auto bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                      {hotLeadsCount}
                    </Badge>
                  )}
                </Link>
              </motion.div>
            );
          })}

          {/* AI Chat link */}
          <Link
            href="/ai-chat"
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
              pathname === '/ai-chat'
                ? 'bg-gradient-to-r from-sky-500/15 to-blue-500/10 text-primary dark:from-sky-500/20 dark:to-blue-500/15'
                : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground'
            )}
          >
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
              pathname === '/ai-chat'
                ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-foreground'
            )}>
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="flex-1">{navItems[navItems.length - 1].label}</span>
            <span className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              AI
            </span>
          </Link>
        </nav>

        {/* AI Thinking indicator */}
        <AnimatePresence>
          {isAIThinking && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-200/80 dark:border-slate-800 overflow-hidden"
            >
              <div className="px-3 py-2 flex items-center gap-2 bg-sky-50/50 dark:bg-sky-950/20">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-sky-600 dark:text-sky-400">{currentAIOperation}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom section */}
        <div className="border-t border-slate-200/80 dark:border-slate-800 p-3 space-y-1">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              pathname === '/settings'
                ? 'bg-slate-100 dark:bg-slate-800'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {displayName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <Badge variant="outline" className={cn('mt-0.5 text-[10px]', roleInfo.color)}>
                {profile?.role === 'admin' && <Shield className="mr-1 h-2.5 w-2.5" />}
                {roleInfo.label}
              </Badge>
            </div>
          </Link>

          {/* Theme toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full justify-start gap-2"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>

          {/* Keyboard hints */}
          <div className="pt-2 text-center text-[10px] text-muted-foreground/60">
            ⌘K search • ⌘⇧K AI • ? help
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 backdrop-blur-xl lg:hidden">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-blue-500/25">
              <Network className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">Nexus</span>
          </Link>
          <button
            onClick={() => openCommandBar()}
            className="rounded-md p-2 text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </header>

        {/* Desktop header with breadcrumb */}
        <header className="hidden lg:flex sticky top-0 z-20 h-14 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{pageNames[pathname] || 'Page'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard?search=true')}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3 py-1.5 text-sm text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600 transition-all"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Search...</span>
              <kbd className="ml-2 text-[10px] font-medium bg-slate-200/50 dark:bg-slate-700/50 px-1 rounded">⌘K</kbd>
            </button>
            <Button variant="ghost" size="sm" onClick={() => openCommandBar()} className="gap-2 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/50 dark:to-blue-950/50">
              <Sparkles className="h-4 w-4 text-sky-600" />
              Ask AI
            </Button>
          </div>
        </header>

        {/* Page content with animation */}
        <main className="flex-1 p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global AI Command Bar */}
      <AICommandBar />
    </div>
  );
}
