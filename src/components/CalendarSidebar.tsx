'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthProvider'
import { getDemoCalendarEvents } from '@/lib/demo-data'
import { Task } from '@/hooks/useUserData'

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

// Unified item type for display
interface ScheduledItem {
  id: string
  title: string
  start_time: string
  type: 'event' | 'task'
  location?: string | null
  all_day?: boolean
  linked_task_id?: string | null
  task?: Task
}

interface CalendarSidebarProps {
  onLinkToTask?: (eventId: string, eventTitle: string) => void
  onSelectTask?: (task: Task) => void
  tasks?: Task[]
  className?: string
  isDemoUser?: boolean
}

export function CalendarSidebar({ onLinkToTask, onSelectTask, tasks = [], className = '', isDemoUser }: CalendarSidebarProps) {
  const { session } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Get scheduled tasks (next 7 days)
  const scheduledTasks = useMemo(() => {
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return tasks.filter(task => {
      if (!task.scheduled_at || task.category === 'completed') return false
      const scheduledDate = new Date(task.scheduled_at)
      return scheduledDate >= now && scheduledDate <= weekFromNow
    })
  }, [tasks])

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

  // Combine events and scheduled tasks into unified items
  const allItems = useMemo((): ScheduledItem[] => {
    const items: ScheduledItem[] = []

    // Add calendar events
    events.forEach(event => {
      items.push({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        type: 'event',
        location: event.location,
        all_day: event.all_day,
        linked_task_id: event.linked_task_id,
      })
    })

    // Add scheduled tasks
    scheduledTasks.forEach(task => {
      if (task.scheduled_at) {
        items.push({
          id: `task-${task.id}`,
          title: task.title,
          start_time: task.scheduled_at,
          type: 'task',
          task,
        })
      }
    })

    return items
  }, [events, scheduledTasks])

  // Group items by date
  const groupedItems = useMemo(() => {
    return allItems.reduce((acc, item) => {
      const date = new Date(item.start_time).toISOString().split('T')[0]
      if (!acc[date]) acc[date] = []
      acc[date].push(item)
      return acc
    }, {} as Record<string, ScheduledItem[]>)
  }, [allItems])

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

  // Show if we have calendar events OR scheduled tasks
  const hasItems = enabled || scheduledTasks.length > 0

  if (!hasItems) {
    return null
  }

  if (loading && scheduledTasks.length === 0) {
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

  if (allItems.length === 0) {
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
          Upcoming ({allItems.length})
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

      {/* Events and scheduled tasks list */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {Object.entries(groupedItems)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dateItems]) => (
              <div key={date}>
                <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
                  {formatDateHeader(date)}
                </div>
                <div className="space-y-2">
                  {dateItems
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                    .map((item) => (
                    <div
                      key={item.id}
                      onClick={item.type === 'task' && item.task && onSelectTask ? () => onSelectTask(item.task!) : undefined}
                      className={`
                        group p-3 rounded-lg border transition-colors duration-150 ease-out
                        ${item.type === 'task'
                          ? 'bg-accent/5 border-accent/30 hover:border-accent cursor-pointer'
                          : 'bg-surface border-border hover:border-border-strong'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {item.type === 'task' && (
                              <svg width={12} height={12} viewBox="0 0 16 16" className="text-accent shrink-0">
                                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </svg>
                            )}
                            <span className="text-sm font-medium text-text truncate">
                              {item.title}
                            </span>
                          </div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {formatTime(item.start_time, item.all_day || false)}
                            {item.type === 'task' && (
                              <span className="ml-2 text-accent">· Scheduled task</span>
                            )}
                            {item.location && (
                              <span className="ml-2">
                                · {item.location.length > 20 ? item.location.slice(0, 20) + '...' : item.location}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.type === 'event' && onLinkToTask && !item.linked_task_id && (
                          <button
                            onClick={() => onLinkToTask(item.id, item.title)}
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
                        {item.type === 'event' && item.linked_task_id && (
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

interface CalendarWidgetProps {
  className?: string
  isDemoUser?: boolean
  tasks?: Task[]
  onSelectTask?: (task: Task) => void
}

/**
 * Compact calendar widget for the home view.
 */
export function CalendarWidget({ className = '', isDemoUser, tasks = [], onSelectTask }: CalendarWidgetProps) {
  const { session } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)

  // Get scheduled tasks (next 7 days)
  const scheduledTasks = useMemo(() => {
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return tasks.filter(task => {
      if (!task.scheduled_at || task.category === 'completed') return false
      const scheduledDate = new Date(task.scheduled_at)
      return scheduledDate >= now && scheduledDate <= weekFromNow
    })
  }, [tasks])

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

  // Combine events and scheduled tasks
  const allItems = useMemo((): ScheduledItem[] => {
    const items: ScheduledItem[] = []

    events.forEach(event => {
      items.push({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        type: 'event',
        all_day: event.all_day,
        location: event.location,
      })
    })

    scheduledTasks.forEach(task => {
      if (task.scheduled_at) {
        items.push({
          id: `task-${task.id}`,
          title: task.title,
          start_time: task.scheduled_at,
          type: 'task',
          task,
        })
      }
    })

    // Sort by start time
    return items.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [events, scheduledTasks])

  const hasItems = enabled || scheduledTasks.length > 0

  if (!hasItems || loading || allItems.length === 0) {
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
      <div className="bg-card rounded-xl border border-border-subtle overflow-hidden">
        {allItems.slice(0, 4).map((item, idx) => (
          <div
            key={item.id}
            onClick={item.type === 'task' && item.task && onSelectTask ? () => onSelectTask(item.task!) : undefined}
            className={`
              flex items-center gap-3 px-4 py-3
              ${idx > 0 ? 'border-t border-border' : ''}
              ${item.type === 'task' ? 'cursor-pointer hover:bg-surface/50' : ''}
            `}
          >
            {item.type === 'task' ? (
              <svg width={12} height={12} viewBox="0 0 16 16" className="text-accent shrink-0">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            ) : (
              <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text truncate">{item.title}</div>
              <div className="text-xs text-text-muted">
                {formatEventTime(item.start_time, item.all_day || false)}
                {item.type === 'task' && <span className="text-accent"> · Task</span>}
                {item.location && ` · ${item.location.slice(0, 25)}${item.location.length > 25 ? '...' : ''}`}
              </div>
            </div>
          </div>
        ))}
        {allItems.length > 4 && (
          <div className="px-4 py-2 border-t border-border bg-surface/50 text-xs text-text-muted text-center">
            +{allItems.length - 4} more this week
          </div>
        )}
      </div>
    </div>
  )
}
