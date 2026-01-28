'use client'

import { useEffect, useCallback } from 'react'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  meta?: boolean
  action: () => void
  description: string
}

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutConfig[]
  enabled?: boolean
}

/**
 * Hook for handling keyboard shortcuts
 * Respects input focus - shortcuts are disabled when typing
 */
export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey)
      const shiftMatch = !!shortcut.shift === event.shiftKey

      if (keyMatch && ctrlMatch && shiftMatch) {
        event.preventDefault()
        shortcut.action()
        return
      }
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
  const parts: string[] = []

  if (shortcut.ctrl) {
    // Use Cmd on Mac, Ctrl on Windows/Linux
    const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
    parts.push(isMac ? '⌘' : 'Ctrl')
  }

  if (shortcut.shift) {
    parts.push('⇧')
  }

  // Format key nicely
  const key = shortcut.key.length === 1
    ? shortcut.key.toUpperCase()
    : shortcut.key.replace('Arrow', '').replace('Escape', 'Esc')
  parts.push(key)

  return parts.join(' + ')
}
