'use client'

import { useMemo } from 'react'
import { Task } from '@/hooks/useUserData'
import { EnergyLevel } from '@/lib/constants'
import { EnergyBadge } from './EnergyBadge'

interface EnergySuggestionsProps {
  tasks: Task[]
  currentTaskId?: string  // The "Do this now" task to exclude
  onGoToTask: (taskId: string) => void
}

// Get time-based suggestion message
function getTimeBasedMessage(): { message: string; preferLowEnergy: boolean } {
  const hour = new Date().getHours()

  // Late night (9pm - 6am): Definitely suggest low energy
  if (hour >= 21 || hour < 6) {
    return { message: "Late night? Try something easy", preferLowEnergy: true }
  }

  // Evening (5pm - 9pm): Winding down
  if (hour >= 17) {
    return { message: "Winding down? Try these", preferLowEnergy: true }
  }

  // Afternoon slump (2pm - 5pm): Could use easy wins
  if (hour >= 14) {
    return { message: "Need a quick win?", preferLowEnergy: true }
  }

  // Default: Show as alternative
  return { message: "Not feeling it? Try these instead", preferLowEnergy: true }
}

export function EnergySuggestions({ tasks, currentTaskId, onGoToTask }: EnergySuggestionsProps) {
  // Filter to low-energy tasks that aren't the current task
  const lowEnergyTasks = useMemo(() => {
    return tasks.filter(task => {
      // Exclude the current "Do this now" task
      if (task.id === currentTaskId) return false
      // Must be low energy
      if (task.energy !== EnergyLevel.LOW) return false
      // Must have incomplete steps
      const steps = task.steps || []
      if (steps.length === 0) return false
      if (steps.every(s => s.done)) return false
      // Not snoozed
      if (task.snoozed_until) {
        const today = new Date().toISOString().split('T')[0]
        if (task.snoozed_until > today) return false
      }
      return true
    }).slice(0, 3) // Limit to 3 suggestions
  }, [tasks, currentTaskId])

  // Don't show if no low-energy alternatives
  if (lowEnergyTasks.length === 0) return null

  const { message } = getTimeBasedMessage()

  return (
    <div className="mb-6 animate-rise" style={{ animationDelay: '100ms' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px]">🌿</span>
        <span className="text-xs text-text-muted">{message}</span>
      </div>

      {/* Task chips */}
      <div className="flex flex-wrap gap-2">
        {lowEnergyTasks.map(task => (
          <button
            key={task.id}
            onClick={() => onGoToTask(task.id)}
            className="
              px-3 py-2
              bg-success/5 border border-success/20 rounded-lg
              text-sm text-text
              hover:bg-success/10 hover:border-success/30
              transition-all duration-150
              flex items-center gap-2
              max-w-[200px]
            "
          >
            <span className="truncate">{task.title}</span>
            <EnergyBadge energy={EnergyLevel.LOW} size="sm" />
          </button>
        ))}
      </div>
    </div>
  )
}
