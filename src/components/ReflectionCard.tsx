'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface ReflectionContent {
  wins: string[]
  patterns: string[]
  suggestions: string[]
  encouragement: string
  stats: {
    tasksCompleted: number
    onTimeCompletions: number
    busiestDay: string
    productiveHours: string
    streakDays: number
  }
}

interface Reflection {
  id: string
  week_start: string
  content: ReflectionContent
  created_at: string
}

interface ReflectionCardProps {
  user: User | null
  onDismiss?: () => void
}

/**
 * Weekly reflection card showing wins, patterns, and encouragement
 */
export function ReflectionCard({ user, onDismiss }: ReflectionCardProps) {
  const [reflection, setReflection] = useState<Reflection | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>('wins')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadReflection = async () => {
      // Get the most recent reflection
      const { data, error } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error loading reflection:', error)
      } else if (data) {
        // Only show if within the last week
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const reflectionDate = new Date(data.week_start)

        if (reflectionDate >= weekAgo) {
          setReflection(data)
        }
      }

      setLoading(false)
    }

    // Check localStorage for dismissed state
    const dismissedKey = `reflection-dismissed-${user.id}`
    const dismissedWeek = localStorage.getItem(dismissedKey)
    if (dismissedWeek) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const currentWeek = weekStart.toISOString().split('T')[0]

      if (dismissedWeek === currentWeek) {
        setDismissed(true)
        setLoading(false)
        return
      }
    }

    loadReflection()
  }, [user])

  const handleDismiss = () => {
    if (user && reflection) {
      const dismissedKey = `reflection-dismissed-${user.id}`
      localStorage.setItem(dismissedKey, reflection.week_start)
    }
    setDismissed(true)
    onDismiss?.()
  }

  if (loading || !reflection || dismissed) return null

  const { content } = reflection
  const weekDate = new Date(reflection.week_start)
  const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="bg-gradient-to-br from-[var(--elevated)] to-[var(--surface)] rounded-2xl p-5 shadow-sm border border-[var(--surface)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--text)]">
            Your Week in Review
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Week of {weekLabel}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-[var(--surface)]">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-[var(--accent)]">
            {content.stats.tasksCompleted}
          </div>
          <div className="text-xs text-[var(--text-muted)]">completed</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-[var(--success)]">
            {Math.round((content.stats.onTimeCompletions / Math.max(content.stats.tasksCompleted, 1)) * 100)}%
          </div>
          <div className="text-xs text-[var(--text-muted)]">on time</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-lg font-semibold text-[var(--text)]">
            {content.stats.busiestDay?.slice(0, 3) || '—'}
          </div>
          <div className="text-xs text-[var(--text-muted)]">best day</div>
        </div>
      </div>

      {/* Expandable sections */}
      <div className="space-y-3">
        {/* Wins */}
        {content.wins.length > 0 && (
          <Section
            title="Wins"
            emoji="🎉"
            expanded={expandedSection === 'wins'}
            onToggle={() => setExpandedSection(expandedSection === 'wins' ? null : 'wins')}
          >
            <ul className="space-y-2">
              {content.wins.map((win, i) => (
                <li key={i} className="text-sm text-[var(--text-soft)] pl-4 relative">
                  <span className="absolute left-0 text-[var(--success)]">✓</span>
                  {win}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Patterns */}
        {content.patterns.length > 0 && (
          <Section
            title="Patterns"
            emoji="📊"
            expanded={expandedSection === 'patterns'}
            onToggle={() => setExpandedSection(expandedSection === 'patterns' ? null : 'patterns')}
          >
            <ul className="space-y-2">
              {content.patterns.map((pattern, i) => (
                <li key={i} className="text-sm text-[var(--text-soft)]">
                  {pattern}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Suggestions */}
        {content.suggestions.length > 0 && (
          <Section
            title="For Next Week"
            emoji="💡"
            expanded={expandedSection === 'suggestions'}
            onToggle={() => setExpandedSection(expandedSection === 'suggestions' ? null : 'suggestions')}
          >
            <ul className="space-y-2">
              {content.suggestions.map((suggestion, i) => (
                <li key={i} className="text-sm text-[var(--text-soft)]">
                  {suggestion}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Encouragement footer */}
      <div className="mt-4 pt-4 border-t border-[var(--surface)]">
        <p className="text-sm text-[var(--text)] italic text-center">
          "{content.encouragement}"
        </p>
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  emoji: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Section({ title, emoji, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="rounded-xl bg-[var(--surface)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
          <span>{emoji}</span>
          {title}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

/**
 * Hook to check if there's a pending reflection to show
 */
export function useHasReflection(user: User | null): boolean {
  const [hasReflection, setHasReflection] = useState(false)

  useEffect(() => {
    if (!user) return

    const check = async () => {
      const { data } = await supabase
        .from('reflections')
        .select('week_start')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        // Check if within last week and not dismissed
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const reflectionDate = new Date(data.week_start)

        if (reflectionDate >= weekAgo) {
          const dismissedKey = `reflection-dismissed-${user.id}`
          const dismissedWeek = localStorage.getItem(dismissedKey)
          setHasReflection(dismissedWeek !== data.week_start)
        }
      }
    }

    check()
  }, [user])

  return hasReflection
}
