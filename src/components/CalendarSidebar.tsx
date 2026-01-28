'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthProvider'

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
}

export function CalendarSidebar({ onLinkToTask, className = '' }: CalendarSidebarProps) {
  const { session } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const fetchEvents = useCallback(async () => {
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
      console.error('Error fetching calendar events:', err)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

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
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/50 transition-colors"
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
                      className="group p-3 bg-surface rounded-lg border border-border hover:border-border-strong transition-colors"
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
                              opacity-0 group-hover:opacity-100
                              p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10
                              transition-all
                            "
                            title="Create task from event"
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
export function CalendarWidget({ className = '' }: { className?: string }) {
  const { session } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    async function fetchEvents() {
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
        console.error('Error fetching calendar events:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [session?.access_token])

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
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-text-soft mb-2">
        <svg width={14} height={14} viewBox="0 0 24 24" className="text-accent">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
          <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
        </svg>
        Upcoming
      </div>
      <div className="space-y-2">
        {events.slice(0, 3).map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 p-2 bg-surface/50 rounded-lg"
          >
            <div className="text-xs text-text-muted w-20 shrink-0">
              {formatEventTime(event.start_time, event.all_day)}
            </div>
            <div className="text-sm text-text truncate flex-1">
              {event.title}
            </div>
          </div>
        ))}
        {events.length > 3 && (
          <div className="text-xs text-text-muted text-center">
            +{events.length - 3} more
          </div>
        )}
      </div>
    </div>
  )
}
