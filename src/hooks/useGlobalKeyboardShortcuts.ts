'use client'

import { useEffect, useCallback } from 'react'

interface GlobalKeyboardShortcutsOptions {
  onShowKeyboardShortcuts: () => void
  onHideKeyboardShortcuts: () => void
  onShowFocusLauncher: () => void
  onHideFocusLauncher: () => void
  onShowHelpMePick: () => void
  onHideHelpMePick: () => void
  onShowBrainDump: () => void
  onHideBrainDump: () => void
  onShowCommandPalette: () => void
  onHideCommandPalette: () => void
  // Current state to determine what to show/hide
  showKeyboardShortcuts: boolean
  showFocusLauncher: boolean
  showHelpMePick: boolean
  showBrainDump: boolean
  showCommandPalette: boolean
  currentTaskId: string | null
}

/**
 * Hook to handle global keyboard shortcuts across the Gather app.
 *
 * Shortcuts:
 * - '?' or Shift+/ : Show keyboard shortcuts modal
 * - Cmd+K or '`' : Open command palette
 * - 'f' : Open focus launcher (when not in task view or modal)
 * - 'h' : Open help me pick (when not in task view or modal)
 * - 'd' : Open brain dump (when not in task view or modal)
 * - Escape : Close any open modal
 */
export function useGlobalKeyboardShortcuts(options: GlobalKeyboardShortcutsOptions) {
  const {
    onShowKeyboardShortcuts,
    onHideKeyboardShortcuts,
    onShowFocusLauncher,
    onHideFocusLauncher,
    onShowHelpMePick,
    onHideHelpMePick,
    onShowBrainDump,
    onHideBrainDump,
    onShowCommandPalette,
    onHideCommandPalette,
    showKeyboardShortcuts,
    showFocusLauncher,
    showHelpMePick,
    showBrainDump,
    showCommandPalette,
    currentTaskId,
  } = options

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in inputs (except for Cmd+K which should work anywhere)
    const target = e.target as HTMLElement
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    // Cmd+K or Ctrl+K to open command palette (works even in inputs)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      if (showCommandPalette) {
        onHideCommandPalette()
      } else {
        onShowCommandPalette()
      }
      return
    }

    // Escape to close command palette
    if (e.key === 'Escape' && showCommandPalette) {
      e.preventDefault()
      onHideCommandPalette()
      return
    }

    // Don't process other shortcuts when in inputs
    if (isInInput) {
      return
    }

    // '`' (backtick) to open command palette (when not in input)
    if (e.key === '`' && !showCommandPalette && !showKeyboardShortcuts && !showFocusLauncher && !showHelpMePick && !showBrainDump) {
      e.preventDefault()
      onShowCommandPalette()
      return
    }

    // '?' to show keyboard shortcuts (Shift + /)
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault()
      onShowKeyboardShortcuts()
    }

    // Escape to close keyboard shortcuts
    if (e.key === 'Escape' && showKeyboardShortcuts) {
      e.preventDefault()
      onHideKeyboardShortcuts()
    }

    // 'f' to toggle focus launcher (when not in a modal)
    if (e.key === 'f' && !showKeyboardShortcuts && !showFocusLauncher && !showCommandPalette && !currentTaskId) {
      e.preventDefault()
      onShowFocusLauncher()
    }

    // Escape to close focus launcher
    if (e.key === 'Escape' && showFocusLauncher) {
      e.preventDefault()
      onHideFocusLauncher()
    }

    // 'h' to show help me pick (when not in a modal or task view)
    if (e.key === 'h' && !showKeyboardShortcuts && !showFocusLauncher && !showHelpMePick && !showCommandPalette && !currentTaskId) {
      e.preventDefault()
      onShowHelpMePick()
    }

    // Escape to close help me pick
    if (e.key === 'Escape' && showHelpMePick) {
      e.preventDefault()
      onHideHelpMePick()
    }

    // 'd' to open brain dump (when not in a modal or task view)
    if (e.key === 'd' && !showKeyboardShortcuts && !showFocusLauncher && !showHelpMePick && !showBrainDump && !showCommandPalette && !currentTaskId) {
      e.preventDefault()
      onShowBrainDump()
    }

    // Escape to close brain dump
    if (e.key === 'Escape' && showBrainDump) {
      e.preventDefault()
      onHideBrainDump()
    }
  }, [
    onShowKeyboardShortcuts,
    onHideKeyboardShortcuts,
    onShowFocusLauncher,
    onHideFocusLauncher,
    onShowHelpMePick,
    onHideHelpMePick,
    onShowBrainDump,
    onHideBrainDump,
    onShowCommandPalette,
    onHideCommandPalette,
    showKeyboardShortcuts,
    showFocusLauncher,
    showHelpMePick,
    showBrainDump,
    showCommandPalette,
    currentTaskId,
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
