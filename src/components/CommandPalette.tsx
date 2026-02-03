'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTheme } from './ThemeProvider'

interface Command {
  id: string
  label: string
  shortcut?: string
  category: 'actions' | 'navigation' | 'settings'
  icon: React.ReactNode
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onOpenTemplates: () => void
  onOpenBrainDump: () => void
  onOpenFocusLauncher: () => void
  onOpenHelpMePick: () => void
  onOpenSettings: () => void
}

// Category display order and labels
const categoryOrder: Array<{ key: 'actions' | 'navigation' | 'settings'; label: string }> = [
  { key: 'actions', label: 'Actions' },
  { key: 'navigation', label: 'Navigation' },
  { key: 'settings', label: 'Settings' },
]

// Icons as components for reuse
const icons = {
  template: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  ),
  dump: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M2 12h20" />
      <path d="M12 6l4 4-4 4-4-4z" />
    </svg>
  ),
  event: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  reminder: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  habit: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  focus: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  pick: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  settings: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  theme: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
}

/**
 * Simple fuzzy match - checks if all characters in query appear in text in order
 */
function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  let textIndex = 0
  for (let i = 0; i < lowerQuery.length; i++) {
    const char = lowerQuery[i]
    const foundIndex = lowerText.indexOf(char, textIndex)
    if (foundIndex === -1) return false
    textIndex = foundIndex + 1
  }
  return true
}

/**
 * Command Palette - Spotlight-style command launcher
 *
 * Opens with Cmd+K or ` key for quick access to all features.
 * Supports fuzzy search and keyboard navigation.
 */
export function CommandPalette({
  isOpen,
  onClose,
  onOpenTemplates,
  onOpenBrainDump,
  onOpenFocusLauncher,
  onOpenHelpMePick,
  onOpenSettings,
}: CommandPaletteProps) {
  const { theme, toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Build commands list
  const commands: Command[] = useMemo(() => [
    // Actions
    {
      id: 'templates',
      label: 'Open templates',
      shortcut: '/t',
      category: 'actions',
      icon: icons.template,
      action: () => { onClose(); onOpenTemplates() },
    },
    {
      id: 'brain-dump',
      label: 'Brain dump mode',
      shortcut: '/dump',
      category: 'actions',
      icon: icons.dump,
      action: () => { onClose(); onOpenBrainDump() },
    },
    {
      id: 'event',
      label: 'Create event',
      shortcut: '/e',
      category: 'actions',
      icon: icons.event,
      action: () => {
        onClose()
        // Focus the input and type /e
        const input = document.querySelector('input[placeholder*="What"]') as HTMLInputElement
        if (input) {
          input.focus()
          input.value = '/e '
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      },
    },
    {
      id: 'reminder',
      label: 'Create reminder',
      shortcut: '/r',
      category: 'actions',
      icon: icons.reminder,
      action: () => {
        onClose()
        const input = document.querySelector('input[placeholder*="What"]') as HTMLInputElement
        if (input) {
          input.focus()
          input.value = '/r '
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      },
    },
    {
      id: 'habit',
      label: 'Create habit',
      shortcut: '/h',
      category: 'actions',
      icon: icons.habit,
      action: () => {
        onClose()
        const input = document.querySelector('input[placeholder*="What"]') as HTMLInputElement
        if (input) {
          input.focus()
          input.value = '/h '
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      },
    },
    // Navigation
    {
      id: 'focus-mode',
      label: 'Focus mode',
      shortcut: 'F',
      category: 'navigation',
      icon: icons.focus,
      action: () => { onClose(); onOpenFocusLauncher() },
    },
    {
      id: 'help-me-pick',
      label: 'Help me pick',
      shortcut: 'H',
      category: 'navigation',
      icon: icons.pick,
      action: () => { onClose(); onOpenHelpMePick() },
    },
    // Settings
    {
      id: 'settings',
      label: 'Settings',
      category: 'settings',
      icon: icons.settings,
      action: () => { onClose(); onOpenSettings() },
    },
    {
      id: 'theme',
      label: theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
      category: 'settings',
      icon: icons.theme,
      action: () => { toggleTheme(); onClose() },
    },
  ], [onClose, onOpenTemplates, onOpenBrainDump, onOpenFocusLauncher, onOpenHelpMePick, onOpenSettings, theme, toggleTheme])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    return commands.filter(cmd =>
      fuzzyMatch(cmd.label, query) ||
      (cmd.shortcut && fuzzyMatch(cmd.shortcut, query))
    )
  }, [commands, query])

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) groups[cmd.category] = []
      groups[cmd.category].push(cmd)
    }
    return groups
  }, [filteredCommands])

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    const result: Command[] = []
    for (const { key } of categoryOrder) {
      if (groupedCommands[key]) {
        result.push(...groupedCommands[key])
      }
    }
    return result
  }, [groupedCommands])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatCommands.length > 0) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, flatCommands.length])

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }, [onClose])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < flatCommands.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : flatCommands.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        handleClose()
        break
    }
  }, [flatCommands, selectedIndex, handleClose])

  // Execute command
  const handleSelectCommand = useCallback((command: Command) => {
    command.action()
  }, [])

  if (!isOpen && !isClosing) return null

  // Calculate item indices for keyboard navigation
  let itemIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm ${
          isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
        }`}
      />

      {/* Palette */}
      <div
        className={`relative w-full max-w-md mx-4 bg-elevated rounded-xl overflow-hidden shadow-modal border border-border ${
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        }`}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Commands list */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {flatCommands.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              No commands found
            </div>
          ) : (
            categoryOrder.map(({ key, label }) => {
              const categoryCommands = groupedCommands[key]
              if (!categoryCommands || categoryCommands.length === 0) return null

              return (
                <div key={key} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wide">
                    {label}
                  </div>
                  {categoryCommands.map((command) => {
                    const currentIndex = itemIndex++
                    const isSelected = currentIndex === selectedIndex

                    return (
                      <button
                        key={command.id}
                        data-index={currentIndex}
                        onClick={() => handleSelectCommand(command)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-accent/10 text-accent'
                            : 'text-text hover:bg-surface'
                        }`}
                      >
                        <span className={isSelected ? 'text-accent' : 'text-text-muted'}>
                          {command.icon}
                        </span>
                        <span className="flex-1 text-left text-sm font-medium">
                          {command.label}
                        </span>
                        {command.shortcut && (
                          <kbd className={`px-2 py-0.5 text-xs rounded ${
                            command.shortcut.startsWith('/')
                              ? 'bg-accent/10 text-accent border border-accent/30'
                              : 'bg-surface border border-border text-text-muted'
                          }`}>
                            {command.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px]">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}
