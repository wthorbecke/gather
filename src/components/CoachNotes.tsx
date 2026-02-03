'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import type { CoachingMemory } from '@/lib/coachingMemory'

interface CoachNotesProps {
  isOpen: boolean
  onClose: () => void
  memory: CoachingMemory
  onUpdatePreferences: (updates: Partial<CoachingMemory['preferences']>) => void
  onClearMemory: () => void
}

type TabType = 'patterns' | 'strategies' | 'history' | 'settings'

export function CoachNotes({
  isOpen,
  onClose,
  memory,
  onUpdatePreferences,
  onClearMemory,
}: CoachNotesProps) {
  const [activeTab, setActiveTab] = useState<TabType>('patterns')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const tabs: { id: TabType; label: string }[] = [
    { id: 'patterns', label: 'Patterns' },
    { id: 'strategies', label: 'What Works' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Coach Notes">
      <div className="min-h-[400px]">
        {/* Tab navigation */}
        <div className="flex gap-1 mb-4 border-b border-border-subtle pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeTab === tab.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:text-text hover:bg-surface'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-4">
          {activeTab === 'patterns' && (
            <PatternsTab memory={memory} />
          )}
          {activeTab === 'strategies' && (
            <StrategiesTab memory={memory} />
          )}
          {activeTab === 'history' && (
            <HistoryTab memory={memory} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              preferences={memory.preferences}
              stats={memory.stats}
              onUpdatePreferences={onUpdatePreferences}
              onClearMemory={() => setShowClearConfirm(true)}
            />
          )}
        </div>

        {/* Clear confirmation */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-elevated rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-text mb-2">Clear all memory?</h3>
              <p className="text-text-soft text-sm mb-4">
                This will delete all patterns, strategies, and conversation history.
                This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-text hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onClearMemory()
                    setShowClearConfirm(false)
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-danger text-white hover:bg-danger/90 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ============================================================================
// Patterns Tab
// ============================================================================

function PatternsTab({ memory }: { memory: CoachingMemory }) {
  const { productivityPatterns } = memory

  if (productivityPatterns.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
        title="No patterns yet"
        description="Complete a few tasks and I'll start noticing when you're most productive."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Based on {memory.stats.totalTasksAnalyzed} tasks
      </p>
      {productivityPatterns.map((pattern, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl bg-surface border border-border-subtle"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-text">{pattern.pattern}</p>
              <p className="text-xs text-text-muted mt-1">
                Observed {pattern.observedCount} times
              </p>
            </div>
            <ConfidenceBadge confidence={pattern.confidence} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Strategies Tab
// ============================================================================

function StrategiesTab({ memory }: { memory: CoachingMemory }) {
  const { copingStrategies } = memory

  if (copingStrategies.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        }
        title="No strategies saved yet"
        description="When you find something that helps you get unstuck, I'll remember it for next time."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Strategies that have worked for you
      </p>
      {copingStrategies
        .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
        .map(strategy => (
          <div
            key={strategy.id}
            className="p-4 rounded-xl bg-surface border border-border-subtle"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text font-medium">{strategy.strategy}</p>
                <p className="text-sm text-text-muted mt-1">
                  When: {strategy.trigger}
                </p>
                <p className="text-xs text-text-muted mt-2">
                  Used {strategy.usageCount} times
                </p>
              </div>
            </div>
          </div>
        ))}
    </div>
  )
}

// ============================================================================
// History Tab
// ============================================================================

function HistoryTab({ memory }: { memory: CoachingMemory }) {
  const { strugglesAndVictories, conversationSummaries } = memory
  const recentVictories = strugglesAndVictories
    .filter(sv => sv.type === 'victory')
    .slice(0, 5)
  const recentStruggles = strugglesAndVictories
    .filter(sv => sv.type === 'struggle')
    .slice(0, 5)

  if (strugglesAndVictories.length === 0 && conversationSummaries.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        title="No history yet"
        description="Your wins and challenges will appear here as we work together."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Victories */}
      {recentVictories.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-soft mb-3">Recent Wins</h3>
          <div className="space-y-2">
            {recentVictories.map(v => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20"
              >
                <span className="text-success">+</span>
                <p className="text-sm text-text">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Struggles overcome */}
      {recentStruggles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-soft mb-3">Challenges Faced</h3>
          <div className="space-y-2">
            {recentStruggles.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle"
              >
                <span className="text-text-muted">-</span>
                <div>
                  <p className="text-sm text-text">{s.description}</p>
                  {s.resolution && (
                    <p className="text-xs text-text-muted mt-1">
                      Resolved: {s.resolution}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation summaries */}
      {conversationSummaries.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-soft mb-3">Recent Conversations</h3>
          <div className="space-y-2">
            {conversationSummaries.slice(0, 5).map(conv => (
              <div
                key={conv.id}
                className="p-3 rounded-lg bg-surface border border-border-subtle"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text">
                    {conv.topics.length > 0 ? conv.topics[0] : 'General chat'}
                  </p>
                  {conv.emotionalState && conv.emotionalState !== 'neutral' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent capitalize">
                      {conv.emotionalState}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {new Date(conv.date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Settings Tab
// ============================================================================

interface SettingsTabProps {
  preferences: CoachingMemory['preferences']
  stats: CoachingMemory['stats']
  onUpdatePreferences: (updates: Partial<CoachingMemory['preferences']>) => void
  onClearMemory: () => void
}

function SettingsTab({
  preferences,
  stats,
  onUpdatePreferences,
  onClearMemory,
}: SettingsTabProps) {
  return (
    <div className="space-y-6">
      {/* Memory toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text font-medium">Memory enabled</p>
          <p className="text-sm text-text-muted">
            Remember patterns and strategies across sessions
          </p>
        </div>
        <Toggle
          checked={preferences.memoryEnabled}
          onChange={(checked) => onUpdatePreferences({ memoryEnabled: checked })}
        />
      </div>

      {/* Emotional context toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text font-medium">Share emotional context</p>
          <p className="text-sm text-text-muted">
            Let the AI know when you&apos;re feeling stuck or motivated
          </p>
        </div>
        <Toggle
          checked={preferences.shareEmotionalContext}
          onChange={(checked) => onUpdatePreferences({ shareEmotionalContext: checked })}
        />
      </div>

      {/* Check-in frequency */}
      <div>
        <p className="text-text font-medium mb-2">Proactive check-ins</p>
        <p className="text-sm text-text-muted mb-3">
          When should I reach out to help?
        </p>
        <div className="flex flex-wrap gap-2">
          {(['never', 'when_stuck', 'weekly', 'daily'] as const).map(freq => (
            <button
              key={freq}
              onClick={() => onUpdatePreferences({ checkInFrequency: freq })}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${preferences.checkInFrequency === freq
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border text-text hover:border-accent/40'
                }
              `}
            >
              {freq === 'never' && 'Never'}
              {freq === 'when_stuck' && 'When stuck'}
              {freq === 'weekly' && 'Weekly'}
              {freq === 'daily' && 'Daily'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 rounded-xl bg-surface border border-border-subtle">
        <p className="text-sm font-medium text-text-soft mb-2">Memory Stats</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-muted">Tasks analyzed</p>
            <p className="text-text font-medium">{stats.totalTasksAnalyzed}</p>
          </div>
          <div>
            <p className="text-text-muted">Conversations</p>
            <p className="text-text font-medium">{stats.totalConversationsAnalyzed}</p>
          </div>
        </div>
      </div>

      {/* Clear memory */}
      <button
        onClick={onClearMemory}
        className="w-full px-4 py-3 rounded-lg border border-danger/30 text-danger hover:bg-danger/5 transition-colors text-sm"
      >
        Clear all memory
      </button>

      <p className="text-xs text-text-muted text-center">
        Your data stays on your device (demo) or in your private account.
        It&apos;s never shared or used for training.
      </p>
    </div>
  )
}

// ============================================================================
// Shared Components
// ============================================================================

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-text font-medium mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-[250px]">{description}</p>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100)
  let color = 'bg-text-muted/20 text-text-muted'
  if (percentage >= 70) {
    color = 'bg-success/15 text-success'
  } else if (percentage >= 50) {
    color = 'bg-accent/15 text-accent'
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      {percentage}%
    </span>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
        ${checked ? 'bg-accent' : 'bg-text-muted/30'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full
          bg-white shadow ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  )
}
