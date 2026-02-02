'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
  fetchCalendarEvents,
  GoogleCalendarEvent,
} from '@/lib/googleIntegration'

interface UseCalendarEventsResult {
  events: GoogleCalendarEvent[]
  loading: boolean
  enabled: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Hook for fetching and managing calendar events
 *
 * @param days - Number of days to fetch events for (default: 7)
 * @param autoRefresh - Whether to auto-refresh when component mounts (default: false)
 */
export function useCalendarEvents(
  days: number = 7,
  autoRefresh: boolean = false
): UseCalendarEventsResult {
  const { session } = useAuth()
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token) {
      setLoading(false)
      setEvents([])
      setEnabled(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const result = await fetchCalendarEvents(
        session.access_token,
        days,
        forceRefresh
      )

      setEvents(result.events)
      setEnabled(result.enabled)
    } catch (err) {
      setError('Failed to fetch calendar events')
      setEvents([])
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, days])

  // Initial fetch
  useEffect(() => {
    fetchEvents(autoRefresh)
  }, [fetchEvents, autoRefresh])

  const refresh = useCallback(async () => {
    await fetchEvents(true)
  }, [fetchEvents])

  return {
    events,
    loading,
    enabled,
    error,
    refresh,
  }
}

/**
 * Get events for a specific date from the events array
 */
export function filterEventsForDate(
  events: GoogleCalendarEvent[],
  date: Date
): GoogleCalendarEvent[] {
  return events.filter(event => {
    const eventDate = new Date(event.start_time)
    return (
      eventDate.getFullYear() === date.getFullYear() &&
      eventDate.getMonth() === date.getMonth() &&
      eventDate.getDate() === date.getDate()
    )
  })
}
