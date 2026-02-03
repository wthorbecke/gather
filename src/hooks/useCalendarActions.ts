'use client'

import { useCallback } from 'react'
import type { Task } from '@/hooks/useUserData'
import { authFetch } from '@/lib/supabase'

/**
 * Calendar integration handlers for GatherApp.
 * Handles adding/removing tasks from Google Calendar.
 */

export interface CalendarActionsOptions {
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<{ success: boolean; error?: string } | void>
}

export interface CalendarActionResult {
  success: boolean
  error?: string
}

export interface CalendarActions {
  handleAddToCalendar: (task: Task) => Promise<CalendarActionResult>
  handleRemoveFromCalendar: (task: Task) => Promise<CalendarActionResult>
}

/**
 * Hook that provides calendar integration actions.
 * Separates calendar operations from the main component.
 */
export function useCalendarActions({
  updateTask,
}: CalendarActionsOptions): CalendarActions {
  // Add task to Google Calendar
  const handleAddToCalendar = useCallback(async (task: Task): Promise<CalendarActionResult> => {
    if (!task.due_date) {
      return { success: false, error: 'Task has no due date' }
    }

    try {
      const response = await authFetch('/api/calendar/create-event', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          description: task.description || `Task from Gather: ${task.title}`,
          date: task.due_date,
          allDay: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to add to calendar' }
      }

      const data = await response.json()
      // Save the calendar event ID to the task
      if (data.event?.id) {
        await updateTask(task.id, { calendar_event_id: data.event.id } as Partial<Task>)
      }

      return { success: true }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [updateTask])

  // Remove task from Google Calendar
  const handleRemoveFromCalendar = useCallback(async (task: Task): Promise<CalendarActionResult> => {
    if (!task.calendar_event_id) {
      return { success: false, error: 'Task has no calendar event' }
    }

    try {
      const response = await authFetch(`/api/calendar/create-event?googleEventId=${task.calendar_event_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to remove from calendar' }
      }

      // Clear the calendar event ID from the task
      await updateTask(task.id, { calendar_event_id: null } as Partial<Task>)

      return { success: true }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [updateTask])

  return {
    handleAddToCalendar,
    handleRemoveFromCalendar,
  }
}
