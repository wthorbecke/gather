'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import type { TaskIntelligenceObservation } from '@/lib/ai'

interface TaskInsightProps {
  onGoToTask: (taskId: string) => void
}

interface StoredInsight extends TaskIntelligenceObservation {
  insightId?: string
}

export function TaskInsight({ onGoToTask }: TaskInsightProps) {
  const { session } = useAuth()
  const [observation, setObservation] = useState<StoredInsight | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Record that an insight was shown
  const recordInsightShown = useCallback(async (obs: TaskIntelligenceObservation) => {
    if (!session?.access_token) return null

    try {
      const response = await fetch('/api/task-intelligence/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          taskId: obs.taskId,
          insightType: obs.type,
          observation: obs.observation,
          suggestion: obs.suggestion,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.id
      }
    } catch {
      // Silently fail - tracking is non-critical
    }
    return null
  }, [session?.access_token])

  // Record outcome (dismissed or acted)
  const recordOutcome = useCallback(async (outcome: 'acted' | 'dismissed') => {
    if (!session?.access_token || !observation?.insightId) return

    try {
      await fetch('/api/task-intelligence/record', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          insightId: observation.insightId,
          outcome,
        }),
      })
    } catch {
      // Silently fail
    }
  }, [session?.access_token, observation?.insightId])

  useEffect(() => {
    if (!session?.access_token || dismissed) return

    // Check sessionStorage to avoid fetching again in same session
    const cachedDismissed = sessionStorage.getItem('task-insight-dismissed')
    if (cachedDismissed) {
      setDismissed(true)
      return
    }

    const cachedObservation = sessionStorage.getItem('task-insight-observation')
    if (cachedObservation) {
      try {
        const cached = JSON.parse(cachedObservation) as StoredInsight
        setObservation(cached)
        return
      } catch {
        // Invalid cache, fetch fresh
      }
    }

    async function fetchInsight() {
      setLoading(true)
      try {
        const response = await fetch('/api/task-intelligence', {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        })

        if (!response.ok) {
          setLoading(false)
          return
        }

        const data = await response.json()
        if (data.observations && data.observations.length > 0) {
          const obs = data.observations[0] as TaskIntelligenceObservation

          // Record that we showed this insight
          const insightId = await recordInsightShown(obs)

          const storedObs: StoredInsight = { ...obs, insightId }
          setObservation(storedObs)
          sessionStorage.setItem('task-insight-observation', JSON.stringify(storedObs))
        }
      } catch {
        // Silently fail
      }
      setLoading(false)
    }

    fetchInsight()
  }, [session?.access_token, dismissed, recordInsightShown])

  const handleDismiss = async () => {
    await recordOutcome('dismissed')
    setDismissed(true)
    setObservation(null)
    sessionStorage.setItem('task-insight-dismissed', 'true')
  }

  const handleGoToTask = async () => {
    if (observation?.taskId) {
      await recordOutcome('acted')
      onGoToTask(observation.taskId)
      setDismissed(true)
      setObservation(null)
      sessionStorage.setItem('task-insight-dismissed', 'true')
    }
  }

  if (loading || !observation || dismissed) {
    return null
  }

  const typeLabels: Record<string, string> = {
    stuck: 'Stuck task',
    vague: 'Needs clarity',
    needs_deadline: 'Floating',
    pattern: 'Pattern noticed',
  }

  return (
    <div className="mb-4 animate-rise">
      <div className="bg-card border border-border rounded-xl p-4 relative">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 text-text-muted hover:text-text transition-colors"
          aria-label="Dismiss insight"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Type badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {typeLabels[observation.type] || 'Insight'}
          </span>
        </div>

        {/* Observation */}
        <p className="text-sm text-text mb-3 pr-6">
          {observation.observation}
        </p>

        {/* Suggestion */}
        <p className="text-sm text-text-soft mb-4">
          {observation.suggestion}
        </p>

        {/* Action */}
        <button
          onClick={handleGoToTask}
          className="
            text-sm font-medium text-accent
            hover:underline
            transition-colors
          "
        >
          Go to task →
        </button>
      </div>
    </div>
  )
}
