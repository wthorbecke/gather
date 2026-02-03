'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Task } from '@/hooks/useUserData'
import { safeGetJSON, safeSetJSON } from '@/lib/storage'

// Nagging intervals in minutes
export const NAG_INTERVALS = {
  FREQUENT: 1,    // Every minute (for urgent tasks)
  NORMAL: 5,      // Every 5 minutes (default)
  RELAXED: 15,    // Every 15 minutes
} as const

export type NagInterval = typeof NAG_INTERVALS[keyof typeof NAG_INTERVALS]

// Escalation levels - reminders get more persistent over time
export const ESCALATION_LEVELS = {
  GENTLE: 0,      // First few reminders - friendly tone
  PERSISTENT: 1,  // After 3 nags - slightly more direct
  URGENT: 2,      // After 6 nags - emphasize importance
  CRITICAL: 3,    // After 10+ nags - maximum urgency
} as const

export type EscalationLevel = typeof ESCALATION_LEVELS[keyof typeof ESCALATION_LEVELS]

// Thresholds for escalation (number of nags before escalating)
const ESCALATION_THRESHOLDS = {
  PERSISTENT: 3,
  URGENT: 6,
  CRITICAL: 10,
}

// Calculate escalation level based on nag count
export function getEscalationLevel(nagCount: number): EscalationLevel {
  if (nagCount >= ESCALATION_THRESHOLDS.CRITICAL) return ESCALATION_LEVELS.CRITICAL
  if (nagCount >= ESCALATION_THRESHOLDS.URGENT) return ESCALATION_LEVELS.URGENT
  if (nagCount >= ESCALATION_THRESHOLDS.PERSISTENT) return ESCALATION_LEVELS.PERSISTENT
  return ESCALATION_LEVELS.GENTLE
}

// Get interval multiplier based on escalation - more frequent as urgency increases
function getIntervalMultiplier(escalationLevel: EscalationLevel): number {
  switch (escalationLevel) {
    case ESCALATION_LEVELS.CRITICAL: return 0.5  // Half the interval
    case ESCALATION_LEVELS.URGENT: return 0.75   // 75% of interval
    case ESCALATION_LEVELS.PERSISTENT: return 1  // Normal interval
    default: return 1
  }
}

// Nagging preferences stored per task
export interface NaggingPrefs {
  enabled: boolean
  interval: NagInterval // minutes
  snoozedUntil?: number // Unix timestamp
  lastNagAt?: number    // Unix timestamp of last notification
  nagCount?: number     // How many times we've nagged (for escalation)
  startedAt?: number    // When nagging was enabled (for context)
}

// Storage key for nagging state
const NAGGING_STORAGE_KEY = 'gather:nagging_state'

// Storage structure
interface NaggingState {
  tasks: Record<string, NaggingPrefs>
  notificationPermission: NotificationPermission | 'unsupported'
}

export interface NaggingActions {
  // Enable/disable nagging for a task
  setNagging: (taskId: string, enabled: boolean, interval?: NagInterval) => void
  // Update the interval for a task
  setNagInterval: (taskId: string, interval: NagInterval) => void
  // Snooze a nag for a task (delays next reminder)
  snoozeNag: (taskId: string, minutes: number) => void
  // Get nagging preferences for a task
  getNaggingPrefs: (taskId: string) => NaggingPrefs | null
  // Request notification permission
  requestPermission: () => Promise<boolean>
  // Check if notifications are available
  isNotificationSupported: () => boolean
  // Check if we have notification permission
  hasNotificationPermission: () => boolean
  // Clear nagging for a task (when completed)
  clearNagging: (taskId: string) => void
}

export interface NaggingReturn extends NaggingActions {
  // Currently active nag (task that needs attention)
  activeNag: { task: Task; prefs: NaggingPrefs; escalationLevel: EscalationLevel } | null
  // Dismiss the current nag UI
  dismissActiveNag: () => void
  // Complete the task from the nag UI
  completeActiveNag: () => void
  // Permission status
  permissionStatus: NotificationPermission | 'unsupported'
}

/**
 * Hook for managing persistent task nagging - Due-style reminders that keep
 * coming back until the task is done. Perfect for ADHD brains that need
 * external accountability.
 */
export function useNagging(
  tasks: Task[],
  onCompleteTask?: (taskId: string) => void
): NaggingReturn {
  // State
  const [naggingState, setNaggingState] = useState<NaggingState>(() => {
    const stored = safeGetJSON<NaggingState>(NAGGING_STORAGE_KEY, {
      tasks: {},
      notificationPermission: 'unsupported',
    })
    return stored
  })
  const [activeNag, setActiveNag] = useState<{ task: Task; prefs: NaggingPrefs; escalationLevel: EscalationLevel } | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('unsupported')

  // Refs for interval management
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Persist state changes
  useEffect(() => {
    safeSetJSON(NAGGING_STORAGE_KEY, naggingState)
  }, [naggingState])

  // Initialize notification permission status
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission)
      setNaggingState(prev => ({
        ...prev,
        notificationPermission: Notification.permission,
      }))
    } else {
      setPermissionStatus('unsupported')
    }
  }, [])

  // Check if notifications are supported
  const isNotificationSupported = useCallback(() => {
    return typeof window !== 'undefined' && 'Notification' in window
  }, [])

  // Check if we have permission
  const hasNotificationPermission = useCallback(() => {
    return permissionStatus === 'granted'
  }, [permissionStatus])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNotificationSupported()) return false

    try {
      const permission = await Notification.requestPermission()
      setPermissionStatus(permission)
      setNaggingState(prev => ({
        ...prev,
        notificationPermission: permission,
      }))
      return permission === 'granted'
    } catch {
      return false
    }
  }, [isNotificationSupported])

  // Get nagging preferences for a task
  const getNaggingPrefs = useCallback((taskId: string): NaggingPrefs | null => {
    return naggingState.tasks[taskId] || null
  }, [naggingState.tasks])

  // Set nagging for a task
  const setNagging = useCallback((taskId: string, enabled: boolean, interval: NagInterval = NAG_INTERVALS.NORMAL) => {
    setNaggingState(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: {
          enabled,
          interval,
          snoozedUntil: undefined,
          lastNagAt: undefined,
          nagCount: 0,
          startedAt: enabled ? Date.now() : undefined,
        },
      },
    }))
  }, [])

  // Update interval for a task
  const setNagInterval = useCallback((taskId: string, interval: NagInterval) => {
    setNaggingState(prev => {
      const existing = prev.tasks[taskId]
      if (!existing) return prev

      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskId]: {
            ...existing,
            interval,
          },
        },
      }
    })
  }, [])

  // Snooze a nag
  const snoozeNag = useCallback((taskId: string, minutes: number) => {
    const snoozedUntil = Date.now() + minutes * 60 * 1000
    setNaggingState(prev => {
      const existing = prev.tasks[taskId]
      if (!existing) return prev

      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskId]: {
            ...existing,
            snoozedUntil,
            lastNagAt: Date.now(),
          },
        },
      }
    })
    // Dismiss the active nag if it's for this task
    if (activeNag?.task.id === taskId) {
      setActiveNag(null)
    }
  }, [activeNag])

  // Clear nagging for a task
  const clearNagging = useCallback((taskId: string) => {
    setNaggingState(prev => {
      const { [taskId]: removed, ...remaining } = prev.tasks
      return {
        ...prev,
        tasks: remaining,
      }
    })
    if (activeNag?.task.id === taskId) {
      setActiveNag(null)
    }
  }, [activeNag])

  // Dismiss active nag UI
  const dismissActiveNag = useCallback(() => {
    setActiveNag(null)
  }, [])

  // Complete the active nag task
  const completeActiveNag = useCallback(() => {
    if (activeNag && onCompleteTask) {
      onCompleteTask(activeNag.task.id)
      clearNagging(activeNag.task.id)
    }
    setActiveNag(null)
  }, [activeNag, onCompleteTask, clearNagging])

  // Get escalation-aware notification title
  const getNotificationTitle = useCallback((task: Task, escalationLevel: EscalationLevel): string => {
    // Non-judgmental, compassionate messaging per CLAUDE.md
    switch (escalationLevel) {
      case ESCALATION_LEVELS.CRITICAL:
        return `"${task.title}" really needs your attention`
      case ESCALATION_LEVELS.URGENT:
        return `This one keeps coming back: "${task.title}"`
      case ESCALATION_LEVELS.PERSISTENT:
        return `Still waiting on "${task.title}"`
      default:
        return `Hey, "${task.title}" is waiting`
    }
  }, [])

  // Get escalation-aware notification body
  const getNotificationBody = useCallback((task: Task, escalationLevel: EscalationLevel, nagCount: number): string => {
    const steps = task.steps || []
    const nextStep = steps.find(s => !s.done)
    const baseBody = nextStep
      ? `Next: ${nextStep.text}`
      : task.description || 'Time to make progress'

    // Add context for higher escalation levels (still non-judgmental)
    if (escalationLevel >= ESCALATION_LEVELS.URGENT) {
      return `${baseBody}\n\nReminder #${nagCount} - maybe break it down smaller?`
    }
    if (escalationLevel >= ESCALATION_LEVELS.PERSISTENT) {
      return `${baseBody}\n\nThis is reminder #${nagCount}`
    }
    return baseBody
  }, [])

  // Show a system notification with escalation awareness
  const showNotification = useCallback((task: Task, escalationLevel: EscalationLevel, nagCount: number) => {
    if (!hasNotificationPermission()) return

    const title = getNotificationTitle(task, escalationLevel)
    const body = getNotificationBody(task, escalationLevel, nagCount)

    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `nag-${task.id}`,
      requireInteraction: true, // Keep notification until user interacts
      silent: escalationLevel === ESCALATION_LEVELS.GENTLE, // Sound for higher escalation
    })

    // Handle notification click
    notification.onclick = () => {
      window.focus()
      setActiveNag({ task, prefs: naggingState.tasks[task.id], escalationLevel })
      notification.close()
    }
  }, [hasNotificationPermission, naggingState.tasks, getNotificationTitle, getNotificationBody])

  // Check for tasks that need nagging
  const checkForNags = useCallback(() => {
    const now = Date.now()

    for (const task of tasks) {
      const prefs = naggingState.tasks[task.id]
      if (!prefs || !prefs.enabled) continue

      // Skip if task is complete (all steps done)
      const steps = task.steps || []
      const allDone = steps.length > 0 && steps.every(s => s.done)
      if (allDone) {
        // Auto-clear nagging for completed tasks
        clearNagging(task.id)
        continue
      }

      // Skip if snoozed
      if (prefs.snoozedUntil && now < prefs.snoozedUntil) continue

      // Calculate escalation level and adjusted interval
      const nagCount = prefs.nagCount || 0
      const escalationLevel = getEscalationLevel(nagCount)
      const intervalMultiplier = getIntervalMultiplier(escalationLevel)
      const baseIntervalMs = prefs.interval * 60 * 1000
      const adjustedIntervalMs = baseIntervalMs * intervalMultiplier

      const lastNag = prefs.lastNagAt || 0
      const timeSinceLastNag = now - lastNag

      if (timeSinceLastNag >= adjustedIntervalMs) {
        // Time to nag!
        const newNagCount = nagCount + 1
        const newEscalationLevel = getEscalationLevel(newNagCount)

        showNotification(task, newEscalationLevel, newNagCount)

        // Update last nag time and increment nag count
        setNaggingState(prev => ({
          ...prev,
          tasks: {
            ...prev.tasks,
            [task.id]: {
              ...prev.tasks[task.id],
              lastNagAt: now,
              nagCount: newNagCount,
            },
          },
        }))

        // Show in-app notification for the first task needing attention
        if (!activeNag) {
          setActiveNag({ task, prefs: { ...prefs, nagCount: newNagCount }, escalationLevel: newEscalationLevel })
        }

        // Only nag one task at a time (don't overwhelm)
        break
      }
    }
  }, [tasks, naggingState.tasks, activeNag, showNotification, clearNagging])

  // Set up the check interval
  useEffect(() => {
    // Check immediately on mount
    checkForNags()

    // Then check every 30 seconds
    checkIntervalRef.current = setInterval(checkForNags, 30 * 1000)

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [checkForNags])

  // Listen for visibility changes - check when app becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForNags()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkForNags])

  return {
    // State
    activeNag,
    permissionStatus,

    // Actions
    setNagging,
    setNagInterval,
    snoozeNag,
    getNaggingPrefs,
    requestPermission,
    isNotificationSupported,
    hasNotificationPermission,
    clearNagging,
    dismissActiveNag,
    completeActiveNag,
  }
}
