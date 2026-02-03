'use client'

import { useState, useEffect, useCallback } from 'react'

// Session storage key to track if we've shown a whisper this session
const WHISPER_SHOWN_KEY = 'gather:whisper-shown'
const WHISPER_ACTIVITY_KEY = 'gather:whisper-activity'

interface WhisperActivity {
  completions: number
  lastCompletionTime: number | null
  morningCompletions: number
  taskCompletedTitles: string[]
}

function getStoredActivity(): WhisperActivity {
  if (typeof window === 'undefined') {
    return { completions: 0, lastCompletionTime: null, morningCompletions: 0, taskCompletedTitles: [] }
  }
  try {
    const stored = sessionStorage.getItem(WHISPER_ACTIVITY_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return { completions: 0, lastCompletionTime: null, morningCompletions: 0, taskCompletedTitles: [] }
}

function storeActivity(activity: WhisperActivity): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(WHISPER_ACTIVITY_KEY, JSON.stringify(activity))
  } catch {
    // Ignore storage errors
  }
}

function hasWhisperBeenShown(): boolean {
  if (typeof window === 'undefined') return true
  return sessionStorage.getItem(WHISPER_SHOWN_KEY) === 'true'
}

function markWhisperShown(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(WHISPER_SHOWN_KEY, 'true')
}

interface WhisperMessage {
  id: string
  text: string
  priority: number // Lower = higher priority
}

/**
 * Generate contextual whisper based on activity and time
 */
function generateWhisper(activity: WhisperActivity): WhisperMessage | null {
  const messages: WhisperMessage[] = []
  const hour = new Date().getHours()
  const dayOfWeek = new Date().getDay()
  const isFriday = dayOfWeek === 5
  const isMorning = hour >= 5 && hour < 12

  // After completing a task (all steps done)
  if (activity.taskCompletedTitles.length > 0) {
    // Simple acknowledgment for task completion
    messages.push({
      id: 'task-completed',
      text: 'nice work on that one.',
      priority: 5,
    })
  }

  // After 3+ completions in a session
  if (activity.completions >= 3 && activity.completions < 6) {
    messages.push({
      id: 'three-down',
      text: 'three down. you\'re on a roll.',
      priority: 10,
    })
  }

  // After 5+ completions
  if (activity.completions >= 5) {
    messages.push({
      id: 'five-down',
      text: 'momentum building. keep going.',
      priority: 8,
    })
  }

  // Morning productivity
  if (isMorning && activity.morningCompletions >= 2) {
    messages.push({
      id: 'morning-productive',
      text: 'you\'re most productive in the morning - keep going.',
      priority: 15,
    })
  }

  // Friday evening
  if (isFriday && hour >= 16 && hour < 20) {
    messages.push({
      id: 'friday-clear',
      text: 'almost weekend - clear what you can.',
      priority: 20,
    })
  }

  // Late night (after 10pm)
  if (hour >= 22 || hour < 5) {
    messages.push({
      id: 'late-night',
      text: 'late night session. don\'t forget to rest.',
      priority: 25,
    })
  }

  // First completion of the day
  if (activity.completions === 1) {
    messages.push({
      id: 'first-done',
      text: 'first one done. that\'s the hardest part.',
      priority: 12,
    })
  }

  // Sort by priority and return the highest priority message
  messages.sort((a, b) => a.priority - b.priority)
  return messages[0] || null
}

interface CoachWhisperProps {
  /** Called when a step is completed - tracks activity for whispers */
  onCompletionTracked?: () => void
}

/**
 * CoachWhisper - Subtle inline text insights that appear below the input
 *
 * Shows ONE contextual message based on user's recent activity.
 * Auto-dismisses after 10 seconds or on any interaction.
 * Maximum 1 whisper per session to avoid annoyance.
 */
export function CoachWhisper(_props: CoachWhisperProps) {
  const [visible, setVisible] = useState(false)
  const [whisper, setWhisper] = useState<WhisperMessage | null>(null)
  const [mounted, setMounted] = useState(false)

  // Mark as mounted after first render (for SSR hydration)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Generate and show whisper after mount
  useEffect(() => {
    if (!mounted) return

    // Read activity from storage after mount
    const activity = getStoredActivity()

    // Check conditions
    if (hasWhisperBeenShown()) return
    if (activity.completions < 1) return

    const message = generateWhisper(activity)
    if (!message) return

    // Small delay before showing to feel more natural
    const showTimeout = setTimeout(() => {
      setWhisper(message)
      setVisible(true)
      markWhisperShown()
    }, 500)

    return () => clearTimeout(showTimeout)
  }, [mounted])

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!visible) return

    const dismissTimeout = setTimeout(() => {
      setVisible(false)
    }, 10000)

    return () => clearTimeout(dismissTimeout)
  }, [visible])

  // Dismiss on any user interaction
  useEffect(() => {
    if (!visible) return

    const handleInteraction = () => {
      setVisible(false)
    }

    // Listen for various interaction types
    window.addEventListener('click', handleInteraction)
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [visible])

  if (!visible || !whisper) {
    return null
  }

  return (
    <div
      className="
        text-xs text-text-muted italic text-center
        mt-3 mb-1
        animate-fade-in
        opacity-70
        transition-opacity duration-500
      "
      role="status"
      aria-live="polite"
    >
      {whisper.text}
    </div>
  )
}

/**
 * Hook to track whisper activity from outside the component.
 * Call recordCompletion when a step or task is completed.
 */
export function useWhisperActivity() {
  const recordCompletion = useCallback((taskTitle?: string, wasTaskComplete?: boolean) => {
    const activity = getStoredActivity()
    const hour = new Date().getHours()
    const isMorning = hour >= 5 && hour < 12

    const updated: WhisperActivity = {
      completions: activity.completions + 1,
      lastCompletionTime: Date.now(),
      morningCompletions: isMorning ? activity.morningCompletions + 1 : activity.morningCompletions,
      taskCompletedTitles: wasTaskComplete && taskTitle
        ? [...activity.taskCompletedTitles, taskTitle]
        : activity.taskCompletedTitles,
    }

    storeActivity(updated)
    return updated
  }, [])

  const getActivity = useCallback(() => {
    return getStoredActivity()
  }, [])

  return { recordCompletion, getActivity }
}
