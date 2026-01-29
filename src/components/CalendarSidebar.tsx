'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthProvider'
import { getDemoCalendarEvents } from '@/lib/demo-data'

interface CalendarEvent {
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

interface CalendarSidebarProps {
  onLinkToTask?: (eventId: string, eventTitle: string) => void
  className?: string
  isDemoUser?: boolean
}

export function CalendarSidebar({ onLinkToTask, className = '', isDemoUser }: CalendarSidebarProps) {
  const { session } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const fetchEvents = useCallback(async () => {
    // Load demo data in demo mode
    if (isDemoUser) {
      const demoEvents = getDemoCalendarEvents()
      const calendarEvents: CalendarEvent[] = demoEvents.map((e) => ({
        id: e.id,
        google_event_id: e.id,
        title: e.title,
        description: null,
        start_time: e.start_time,
        end_time: new Date(new Date(e.start_time).getTime() + 60 * 60 * 1000).toISOString(),
        all_day: false,
        location: e.location || null,
        linked_task_id: null,
      }))
      setEvents(calendarEvents)
      setEnabled(true)
      setLoading(false)
      return
    }

    if (!session?.access_token) return

    try {
      const res = await fetch('/api/calendar/events?days=7', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        setEnabled(false)
        return
      }

      const data = await res.json()
      setEnabled(data.enabled)
      setEvents(data.events || [])
    } catch (err) {
      // Error handled silently('Error fetching calendar events:', err)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, isDemoUser])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.start_time).toISOString().split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, CalendarEvent[]>)

  const formatTime = (dateStr: string, allDay: boolean) => {
    if (allDay) return 'All day'
    return new Date(dateStr).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  if (!enabled) {
    return null
  }

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-24 bg-surface rounded" />
          <div className="h-12 bg-surface rounded" />
          <div className="h-12 bg-surface rounded" />
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <svg width={16} height={16} viewBox="0 0 24 24" className="text-text-muted">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
          </svg>
          No upcoming events
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] hover:bg-surface/50 transition-colors duration-150 ease-out"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <svg width={16} height={16} viewBox="0 0 24 24" className="text-accent">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
          </svg>
          Upcoming ({events.length})
        </div>
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          className={`text-text-muted transition-transform ${collapsed ? '' : 'rotate-180'}`}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>

      {/* Events list */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {Object.entries(groupedEvents)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dateEvents]) => (
              <div key={date}>
                <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                  {formatDateHeader(date)}
                </div>
                <div className="space-y-2">
                  {dateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="group p-3 bg-surface rounded-lg border border-border hover:border-border-strong transition-colors duration-150 ease-out"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-text truncate">
                            {event.title}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {formatTime(event.start_time, event.all_day)}
                            {event.location && (
                              <span className="ml-2">
                                · {event.location.length > 20 ? event.location.slice(0, 20) + '...' : event.location}
                              </span>
                            )}
                          </div>
                        </div>
                        {onLinkToTask && !event.linked_task_id && (
                          <button
                            onClick={() => onLinkToTask(event.id, event.title)}
                            className="
                              opacity-0 group-hover:opacity-100 focus:opacity-100
                              min-w-[44px] min-h-[44px] -m-2.5 rounded-lg
                              flex items-center justify-center
                              text-text-muted hover:text-accent hover:bg-accent/10
                              transition-all duration-150 ease-out
                              btn-press
                            "
                            title="Create task from event"
                            aria-label="Create task from event"
                          >
                            <svg width={14} height={14} viewBox="0 0 16 16">
                              <path
                                d="M8 3V13M3 8H13"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        )}
                        {event.linked_task_id && (
                          <div className="p-1.5 text-success" title="Linked to task">
                            <svg width={14} height={14} viewBox="0 0 16 16">
                              <path
                                d="M3 8L6.5 11.5L13 5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/**
 * Compact calendar widget for the home view.
 */
export function CalendarWidget({ className = '', isDemoUser }: { className?: string; isDemoUser?: boolean }) {
  const { session } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    async function fetchEvents() {
      // Load demo data in demo mode
      if (isDemoUser) {
        const demoEvents = getDemoCalendarEvents()
        const calendarEvents: CalendarEvent[] = demoEvents.map((e) => ({
          id: e.id,
          google_event_id: e.id,
          title: e.title,
          description: null,
          start_time: e.start_time,
          end_time: new Date(new Date(e.start_time).getTime() + 60 * 60 * 1000).toISOString(),
          all_day: false,
          location: e.location || null,
          linked_task_id: null,
        }))
        setEvents(calendarEvents)
        setEnabled(true)
        setLoading(false)
        return
      }

      if (!session?.access_token) return

      try {
        const res = await fetch('/api/calendar/events?days=7', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!res.ok) {
          setEnabled(false)
          return
        }

        const data = await res.json()
        setEnabled(data.enabled)
        setEvents(data.events || [])
      } catch (err) {
        // Error handled silently('Error fetching calendar events:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [session?.access_token, isDemoUser])

  if (!enabled || loading || events.length === 0) {
    return null
  }

  const formatEventTime = (dateStr: string, allDay: boolean) => {
    if (allDay) return 'All day'
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

    if (date.toDateString() === today.toDateString()) {
      return timeStr
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow ${timeStr}`
    } else {
      return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + timeStr
    }
  }

  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
        <svg width={14} height={14} viewBox="0 0 24 24" className="text-accent">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
          <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
        </svg>
        Coming up
      </div>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {events.slice(0, 4).map((event, idx) => (
          <div
            key={event.id}
            className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''}`}
          >
            <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text truncate">{event.title}</div>
              <div className="text-xs text-text-muted">
                {formatEventTime(event.start_time, event.all_day)}
                {event.location && ` · ${event.location.slice(0, 25)}${event.location.length > 25 ? '...' : ''}`}
              </div>
            </div>
          </div>
        ))}
        {events.length > 4 && (
          <div className="px-4 py-2 border-t border-border bg-surface/50 text-xs text-text-muted text-center">
            +{events.length - 4} more this week
          </div>
        )}
      </div>
    </div>
  )
}
