/**
 * Google Integration Service
 *
 * Bridges Google Calendar events with Gather's task types system.
 * Provides utilities for syncing calendar events as tasks and vice versa.
 */

import { Task } from '@/hooks/useUserData'
import { TaskType, IntegrationProvider } from './constants'

// Types for calendar events from Google API
export interface GoogleCalendarEvent {
  id: string
  google_event_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  all_day: boolean
  location: string | null
  linked_task_id: string | null
}

// Note: Uses ExternalSource from useUserData which has: provider, externalId?, readOnly

/**
 * Convert a Google Calendar event to a Gather task
 */
export function calendarEventToTask(event: GoogleCalendarEvent): Partial<Task> {
  const duration = calculateDurationMinutes(event.start_time, event.end_time)

  return {
    title: event.title,
    description: event.description || undefined,
    type: TaskType.EVENT,
    scheduled_at: event.start_time,
    duration: duration,
    external_source: {
      provider: IntegrationProvider.GOOGLE,
      externalId: event.google_event_id,
      readOnly: true, // Calendar events are read-only in Gather
    },
  }
}

/**
 * Calculate duration in minutes between two timestamps
 */
function calculateDurationMinutes(start: string, end: string): number {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  return Math.round((endTime - startTime) / (1000 * 60))
}

/**
 * Check if a task was imported from Google Calendar
 */
export function isGoogleCalendarTask(task: Task): boolean {
  return task.external_source?.provider === IntegrationProvider.GOOGLE
}

/**
 * Check if a task can be pushed to Google Calendar
 */
export function canPushToCalendar(task: Task): boolean {
  // Can push if:
  // 1. Has a scheduled time
  // 2. Is not already from Google (would create duplicates)
  // 3. Is an event, reminder, or has a specific time
  return Boolean(
    task.scheduled_at &&
    !isGoogleCalendarTask(task) &&
    (task.type === TaskType.EVENT || task.type === TaskType.REMINDER)
  )
}

/**
 * Convert a Gather task to Google Calendar event format
 * (for creating events in Google Calendar)
 */
export function taskToCalendarEvent(task: Task): {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  location?: string
} | null {
  if (!task.scheduled_at) return null

  const startTime = new Date(task.scheduled_at)
  const duration = task.duration || 60 // Default 1 hour
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return {
    summary: task.title,
    description: task.description || undefined,
    start: {
      dateTime: startTime.toISOString(),
      timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone,
    },
  }
}

/**
 * Merge calendar events into existing tasks list
 * - Links existing events by external_id
 * - Creates virtual event tasks for unlinked calendar events
 */
export function mergeCalendarEventsWithTasks(
  tasks: Task[],
  calendarEvents: GoogleCalendarEvent[]
): Task[] {
  const result = [...tasks]

  for (const event of calendarEvents) {
    // Check if already linked to a task
    if (event.linked_task_id) {
      const existingTask = result.find(t => t.id === event.linked_task_id)
      if (existingTask) {
        // Update the task with latest calendar data
        existingTask.scheduled_at = event.start_time
        existingTask.duration = calculateDurationMinutes(event.start_time, event.end_time)
        continue
      }
    }

    // Check if a task already references this event
    const linkedTask = result.find(
      t => t.external_source?.externalId === event.google_event_id
    )
    if (linkedTask) {
      // Already have this event as a task
      continue
    }

    // Create a virtual event task (not persisted, just for display)
    const virtualTask: Task = {
      id: `gcal-${event.google_event_id}`,
      title: event.title,
      description: event.description || null,
      type: TaskType.EVENT,
      scheduled_at: event.start_time,
      duration: calculateDurationMinutes(event.start_time, event.end_time),
      external_source: {
        provider: IntegrationProvider.GOOGLE,
        externalId: event.google_event_id,
        readOnly: true,
      },
      // Default values for required fields
      category: 'soon',
      due_date: null,
      snoozed_until: null,
      context: {},
      actions: [],
      subtasks: [],
      steps: [],
      notes: null,
      badge: null,
    }

    result.push(virtualTask)
  }

  return result
}

/**
 * Filter tasks to get only Google Calendar events for a specific date
 */
export function getCalendarEventsForDate(tasks: Task[], date: Date): Task[] {
  return tasks.filter(task => {
    if (!task.scheduled_at) return false
    if (!isGoogleCalendarTask(task)) return false

    const scheduled = new Date(task.scheduled_at)
    return (
      scheduled.getFullYear() === date.getFullYear() &&
      scheduled.getMonth() === date.getMonth() &&
      scheduled.getDate() === date.getDate()
    )
  })
}

/**
 * API wrapper for pushing a task to Google Calendar
 * Returns the Google event ID if successful
 */
export async function pushTaskToGoogleCalendar(
  task: Task,
  accessToken: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const eventData = taskToCalendarEvent(task)
  if (!eventData) {
    return { success: false, error: 'Task has no scheduled time' }
  }

  try {
    const response = await fetch('/api/calendar/create-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        taskId: task.id,
        event: eventData,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || 'Failed to create event' }
    }

    const data = await response.json()
    return { success: true, eventId: data.eventId }
  } catch (error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Hook helper: Fetch calendar events for the current user
 */
export async function fetchCalendarEvents(
  accessToken: string,
  days: number = 7,
  refresh: boolean = false
): Promise<{ events: GoogleCalendarEvent[]; enabled: boolean }> {
  try {
    const params = new URLSearchParams({
      days: days.toString(),
      ...(refresh && { refresh: 'true' }),
    })

    const response = await fetch(`/api/calendar/events?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return { events: [], enabled: false }
    }

    const data = await response.json()
    return {
      events: data.events || [],
      enabled: data.enabled !== false,
    }
  } catch {
    return { events: [], enabled: false }
  }
}

/**
 * Get sync status for a task
 */
export function getTaskSyncStatus(task: Task): {
  synced: boolean
  provider: string | null
  readOnly: boolean
} {
  if (!task.external_source) {
    return { synced: false, provider: null, readOnly: false }
  }

  return {
    synced: true,
    provider: task.external_source.provider,
    readOnly: task.external_source.readOnly,
  }
}
