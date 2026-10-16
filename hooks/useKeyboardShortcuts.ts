/**
 * Keyboard shortcuts hook
 *
 * Centralized keyboard shortcut management.
 * Prevents conflicts and supports both global and page-specific shortcuts.
 */

import { useEffect, useCallback, useRef } from 'react';

type ShortcutCallback = () => void;

interface ShortcutConfig {
  key: string;
  callback: ShortcutCallback;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  description?: string;
}

const globalShortcuts: Map<string, ShortcutConfig> = new Map();
const pageShortcuts: Map<string, ShortcutConfig> = new Map();

/**
 * Check if the event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return false;
}

/**
 * Register a keyboard shortcut
 */
function registerShortcut(
  map: Map<string, ShortcutConfig>,
  id: string,
  config: ShortcutConfig
): () => void {
  map.set(id, config);
  return () => map.delete(id);
}

/**
 * Global keyboard event handler
 */
function handleKeyDown(event: KeyboardEvent) {
  // Skip if we're in an input element
  if (isInputElement(event.target)) {
    // Except for Escape which should always work
    if (event.key !== 'Escape') {
      return;
    }
  }

  const ctrlOrCmd = event.metaKey || event.ctrlKey;

  // Check page shortcuts first (higher priority)
  pageShortcuts.forEach((config: ShortcutConfig) => {
    if (matchesShortcut(event, config, ctrlOrCmd)) {
      event.preventDefault();
      config.callback();
      return;
    }
  });

  // Then check global shortcuts
  globalShortcuts.forEach((config: ShortcutConfig) => {
    if (matchesShortcut(event, config, ctrlOrCmd)) {
      event.preventDefault();
      config.callback();
      return;
    }
  });
}

/**
 * Check if an event matches a shortcut config
 */
function matchesShortcut(
  event: KeyboardEvent,
  config: ShortcutConfig,
  ctrlOrCmd: boolean
): boolean {
  if (event.key.toLowerCase() !== config.key.toLowerCase()) return false;
  if (config.ctrlOrCmd && !ctrlOrCmd) return false;
  if (!config.ctrlOrCmd && ctrlOrCmd) return false;
  if (config.shift && !event.shiftKey) return false;
  if (!config.shift && event.shiftKey && !config.ctrlOrCmd) return false;
  if (config.alt && !event.altKey) return false;
  return true;
}

// Set up global listener once
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyDown);
}

/**
 * Hook to register global shortcuts (always active)
 */
export function useGlobalShortcuts(shortcuts: ShortcutConfig[] = []) {
  const unregisterFns = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Unregister previous shortcuts
    unregisterFns.current.forEach((fn) => fn());
    unregisterFns.current = [];

    // Register new shortcuts
    shortcuts.forEach((config, index) => {
      const unregister = registerShortcut(globalShortcuts, `global-${index}-${config.key}`, config);
      unregisterFns.current.push(unregister);
    });

    return () => {
      unregisterFns.current.forEach((fn) => fn());
    };
  }, [shortcuts]);
}

/**
 * Hook to register page-specific shortcuts (only active on current page)
 */
export function usePageShortcuts(shortcuts: ShortcutConfig[] = []) {
  const unregisterFns = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Unregister previous shortcuts
    unregisterFns.current.forEach((fn) => fn());
    unregisterFns.current = [];

    // Register new shortcuts
    shortcuts.forEach((config, index) => {
      const unregister = registerShortcut(pageShortcuts, `page-${index}-${config.key}`, config);
      unregisterFns.current.push(unregister);
    });

    return () => {
      unregisterFns.current.forEach((fn) => fn());
    };
  }, [shortcuts]);
}

/**
 * Hook to register a single page shortcut
 */
export function usePageShortcut(
  key: string,
  callback: ShortcutCallback,
  deps: React.DependencyList = [],
  options: { shift?: boolean; alt?: boolean } = {}
) {
  const shortcuts: ShortcutConfig[] = [
    {
      key,
      callback,
      shift: options.shift,
      alt: options.alt,
    },
  ];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  usePageShortcuts(shortcuts);
}

/**
 * Common shortcut configurations
 */
export const SHORTCUTS = {
  openCommandPalette: { key: 'k', ctrlOrCmd: true, description: 'Open command palette' },
  openAICommandBar: { key: 'k', ctrlOrCmd: true, shift: true, description: 'Open AI command bar' },
  openHelp: { key: '?', shift: true, description: 'Show keyboard shortcuts' },
  createNew: { key: 'n', description: 'Create new item' },
  search: { key: '/', description: 'Focus search' },
  escape: { key: 'Escape', description: 'Close modal/dialog' },
} as const;

/**
 * Get all registered shortcuts for help display
 */
export function getAllShortcuts(): Array<{ shortcut: string; description: string }> {
  const result: Array<{ shortcut: string; description: string }> = [];

  globalShortcuts.forEach((config: ShortcutConfig) => {
    if (config.description) {
      const keys: string[] = [];
      if (config.ctrlOrCmd) keys.push('⌘');
      if (config.shift) keys.push('⇧');
      if (config.alt) keys.push('⌥');
      keys.push(config.key.toUpperCase());
      result.push({ shortcut: keys.join(' + '), description: config.description });
    }
  });

  pageShortcuts.forEach((config: ShortcutConfig) => {
    if (config.description) {
      const keys: string[] = [];
      if (config.ctrlOrCmd) keys.push('⌘');
      if (config.shift) keys.push('⇧');
      if (config.alt) keys.push('⌥');
      keys.push(config.key.toUpperCase());
      result.push({ shortcut: keys.join(' + '), description: config.description });
    }
  });

  return result;
}
