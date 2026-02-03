'use client'

interface ShortcutItem {
  keys: string[]  // e.g., ['⌘', 'K'] or ['Space']
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutItem[]
}

interface KeyboardShortcutsModalProps {
  onClose: () => void
}

// Define all shortcuts organized by section
const shortcutSections: ShortcutSection[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Focus on input' },
      { keys: ['D'], description: 'Brain dump - capture everything' },
      { keys: ['F'], description: 'Focus launcher - pick one task' },
      { keys: ['H'], description: 'Help me pick - random task' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / Go back' },
    ],
  },
  {
    title: 'Task Input',
    shortcuts: [
      { keys: ['Enter'], description: 'Submit / AI breakdown' },
      { keys: ['⌘', 'Enter'], description: 'Quick add task' },
      { keys: ['/r'], description: 'Create reminder' },
      { keys: ['/h'], description: 'Create habit' },
      { keys: ['/e'], description: 'Create event' },
      { keys: ['/t'], description: 'Browse templates' },
      { keys: ['/dump'], description: 'Brain dump mode' },
    ],
  },
  {
    title: 'Focus Mode',
    shortcuts: [
      { keys: ['Enter'], description: 'Complete step & continue' },
      { keys: ['Space'], description: 'Pause/resume timer' },
      { keys: ['P'], description: 'Toggle pomodoro mode' },
      { keys: ['S'], description: 'Cycle ambient sounds' },
      { keys: ['D'], description: 'Toggle step details' },
      { keys: ['←'], description: 'Previous step' },
      { keys: ['→'], description: 'Next step' },
      { keys: ['Esc'], description: 'Exit focus mode' },
    ],
  },
  {
    title: 'Date shortcuts in input',
    shortcuts: [
      { keys: ['by tomorrow'], description: 'Set due date to tomorrow' },
      { keys: ['due Friday'], description: 'Set due date to Friday' },
      { keys: ['next week'], description: 'Set due date to next week' },
      { keys: ['in 3 days'], description: 'Set due date in 3 days' },
    ],
  },
]

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-10 bg-elevated border border-border rounded-2xl w-full max-w-lg mx-4 p-6 shadow-modal animate-rise max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Close"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcut sections */}
        <div className="space-y-6">
          {shortcutSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-text-soft">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className={`
                            px-2 py-1 rounded
                            text-xs font-medium
                            ${key.startsWith('/') || key.includes(' ')
                              ? 'bg-accent/10 text-accent border border-accent/30'
                              : 'bg-surface border border-border text-text-soft'
                            }
                          `}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-text-muted text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-soft">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  )
}
