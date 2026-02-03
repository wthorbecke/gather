'use client'

import { useMemo, useRef, useEffect } from 'react'
import { Task } from '@/hooks/useUserData'
import { EnergyLevel } from '@/lib/constants'

interface HourTimelineProps {
  tasks: Task[]
  selectedDate: Date
  onGoToTask: (taskId: string) => void
}

// Hours to display (6am to 11pm)
const START_HOUR = 6
const END_HOUR = 23
const TOTAL_HOURS = END_HOUR - START_HOUR + 1

// Get hour from a scheduled_at timestamp
function getHourFromScheduledAt(scheduledAt: string): number {
  const date = new Date(scheduledAt)
  return date.getHours()
}

// Get minutes from a scheduled_at timestamp
function getMinutesFromScheduledAt(scheduledAt: string): number {
  const date = new Date(scheduledAt)
  return date.getMinutes()
}

// Check if task is scheduled for a specific date
function isScheduledForDate(task: Task, date: Date): boolean {
  if (!task.scheduled_at) return false
  const scheduled = new Date(task.scheduled_at)
  return (
    scheduled.getFullYear() === date.getFullYear() &&
    scheduled.getMonth() === date.getMonth() &&
    scheduled.getDate() === date.getDate()
  )
}

// Get energy level color classes
function getEnergyColorClasses(energy: EnergyLevel | null | undefined): {
  bg: string
  border: string
  text: string
} {
  switch (energy) {
    case EnergyLevel.LOW:
      return {
        bg: 'bg-success/20',
        border: 'border-success/40',
        text: 'text-success',
      }
    case EnergyLevel.MEDIUM:
      return {
        bg: 'bg-amber-500/20',
        border: 'border-amber-500/40',
        text: 'text-amber-600 dark:text-amber-400',
      }
    case EnergyLevel.HIGH:
      return {
        bg: 'bg-accent/20',
        border: 'border-accent/40',
        text: 'text-accent',
      }
    default:
      return {
        bg: 'bg-accent/15',
        border: 'border-accent/30',
        text: 'text-accent',
      }
  }
}

// Format hour for display
function formatHour(hour: number): string {
  if (hour === 0) return '12a'
  if (hour === 12) return '12p'
  if (hour < 12) return `${hour}a`
  return `${hour - 12}p`
}

export function HourTimeline({ tasks, selectedDate, onGoToTask }: HourTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const currentTimeRef = useRef<HTMLDivElement>(null)

  // Filter tasks scheduled for the selected date
  const scheduledTasks = useMemo(() => {
    return tasks.filter(task =>
      isScheduledForDate(task, selectedDate) && task.scheduled_at
    ).sort((a, b) => {
      const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      return timeA - timeB
    })
  }, [tasks, selectedDate])

  // Calculate current time position
  const now = new Date()
  const isToday = selectedDate.toDateString() === now.toDateString()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeVisible = isToday && currentHour >= START_HOUR && currentHour <= END_HOUR

  // Calculate current time position as percentage
  const currentTimePosition = useMemo(() => {
    if (!currentTimeVisible) return 0
    const hourOffset = currentHour - START_HOUR
    const minuteOffset = currentMinute / 60
    return ((hourOffset + minuteOffset) / TOTAL_HOURS) * 100
  }, [currentHour, currentMinute, currentTimeVisible])

  // Scroll to current time on mount (only for today)
  useEffect(() => {
    if (currentTimeVisible && scrollContainerRef.current && currentTimeRef.current) {
      const container = scrollContainerRef.current
      const indicator = currentTimeRef.current
      const containerWidth = container.clientWidth
      const indicatorLeft = indicator.offsetLeft

      // Center the current time indicator in the viewport
      container.scrollLeft = Math.max(0, indicatorLeft - containerWidth / 2)
    }
  }, [currentTimeVisible])

  // Width per hour (in pixels) - wider for better visibility
  const HOUR_WIDTH = 60

  return (
    <div className="mb-6">
      {/* Timeline container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="relative"
          style={{
            width: `${TOTAL_HOURS * HOUR_WIDTH}px`,
            minWidth: '100%',
          }}
        >
          {/* Hour grid background */}
          <div className="h-20 relative">
            {/* Hour columns */}
            <div className="absolute inset-0 flex">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = START_HOUR + i
                const isCurrentHour = isToday && hour === currentHour
                return (
                  <div
                    key={hour}
                    className={`
                      flex-shrink-0 border-r border-border-subtle
                      ${isCurrentHour ? 'bg-accent/5' : ''}
                    `}
                    style={{ width: `${HOUR_WIDTH}px` }}
                  />
                )
              })}
            </div>

            {/* Task blocks */}
            {scheduledTasks.map(task => {
              if (!task.scheduled_at) return null

              const taskHour = getHourFromScheduledAt(task.scheduled_at)
              const taskMinutes = getMinutesFromScheduledAt(task.scheduled_at)

              // Skip tasks outside visible range
              if (taskHour < START_HOUR || taskHour > END_HOUR) return null

              // Calculate position
              const hourOffset = taskHour - START_HOUR
              const minuteOffset = taskMinutes / 60
              const left = (hourOffset + minuteOffset) * HOUR_WIDTH

              // Calculate width based on duration (default 30 min)
              const durationMinutes = task.duration || 30
              const width = Math.max(40, (durationMinutes / 60) * HOUR_WIDTH)

              const colors = getEnergyColorClasses(task.energy)

              return (
                <div
                  key={task.id}
                  onClick={() => onGoToTask(task.id)}
                  className={`
                    absolute top-2 h-14 rounded-md cursor-pointer
                    border ${colors.bg} ${colors.border}
                    hover:shadow-sm hover:scale-[1.02]
                    transition-all duration-150
                    flex items-center px-2 overflow-hidden
                  `}
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    zIndex: 10,
                  }}
                  title={task.title}
                >
                  <span className={`text-xs font-medium truncate ${colors.text}`}>
                    {task.title}
                  </span>
                </div>
              )
            })}

            {/* Current time indicator */}
            {currentTimeVisible && (
              <div
                ref={currentTimeRef}
                className="absolute top-0 bottom-0 w-0.5 bg-danger z-20"
                style={{ left: `${currentTimePosition}%` }}
              >
                {/* Top dot */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-danger" />
              </div>
            )}
          </div>

          {/* Hour labels */}
          <div className="flex border-t border-border-subtle">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const hour = START_HOUR + i
              const isCurrentHour = isToday && hour === currentHour
              return (
                <div
                  key={hour}
                  className={`
                    flex-shrink-0 text-center py-1
                    text-[10px] tabular-nums
                    ${isCurrentHour ? 'text-danger font-medium' : 'text-text-muted'}
                  `}
                  style={{ width: `${HOUR_WIDTH}px` }}
                >
                  {formatHour(hour)}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Empty state hint */}
      {scheduledTasks.length === 0 && (
        <div className="text-center py-2 text-xs text-text-muted">
          No scheduled events. Add a time when creating tasks to see them here.
        </div>
      )}
    </div>
  )
}
