'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Task } from '@/hooks/useUserData'
import { getAlternativeTasks, getTaskPickReason } from '@/lib/taskPicker'
import { EnergyBadge } from './EnergyBadge'
import { EnergyLevel } from '@/lib/constants'
import { splitStepText } from '@/lib/stepText'
import { NoTasksEmptyState } from './NoTasksEmptyState'

// Fun shuffle messages
const SHUFFLE_MESSAGES = [
  'Thinking...',
  'Weighing options...',
  'Considering deadlines...',
  'Checking energy...',
  'Almost there...',
]

// Encouraging reasons tailored to different scenarios
const ENCOURAGEMENT_TEMPLATES = {
  deadline: [
    "This one's calling your name. Let's do it.",
    "Future you will thank present you.",
    "Knock this out before the deadline sneaks up.",
  ],
  quickWin: [
    "Quick win to build momentum.",
    "Easy points. Get it done.",
    "Start small, finish strong.",
  ],
  stale: [
    "This has been waiting. Time to deal with it.",
    "Clear the backlog, clear your mind.",
    "Old tasks weigh you down. Let's lift this one.",
  ],
  pinned: [
    "You pinned this for a reason.",
    "Your past self flagged this. Trust them.",
    "Priority task. Let's go.",
  ],
  energy: [
    "Perfect match for your energy right now.",
    "This fits your current vibe.",
    "Right task, right time.",
  ],
  default: [
    "Trust me on this one.",
    "This is the move.",
    "Do this. Don't overthink it.",
  ],
}

function getEncouragement(reason: string): string {
  if (reason.includes('Overdue') || reason.includes('Due')) {
    return ENCOURAGEMENT_TEMPLATES.deadline[Math.floor(Math.random() * ENCOURAGEMENT_TEMPLATES.deadline.length)]
  }
  if (reason.includes('Quick win')) {
    return ENCOURAGEMENT_TEMPLATES.quickWin[Math.floor(Math.random() * ENCOURAGEMENT_TEMPLATES.quickWin.length)]
  }
  if (reason.includes('pinned')) {
    return ENCOURAGEMENT_TEMPLATES.pinned[Math.floor(Math.random() * ENCOURAGEMENT_TEMPLATES.pinned.length)]
  }
  if (reason.includes('energy')) {
    return ENCOURAGEMENT_TEMPLATES.energy[Math.floor(Math.random() * ENCOURAGEMENT_TEMPLATES.energy.length)]
  }
  return ENCOURAGEMENT_TEMPLATES.default[Math.floor(Math.random() * ENCOURAGEMENT_TEMPLATES.default.length)]
}

interface HelpMePickProps {
  tasks: Task[]
  userEnergy?: EnergyLevel | null
  onSelectTask: (task: Task) => void
  onCancel: () => void
}

export function HelpMePick({
  tasks,
  userEnergy,
  onSelectTask,
  onCancel,
}: HelpMePickProps) {
  const [isShuffling, setIsShuffling] = useState(true)
  const [shuffleIndex, setShuffleIndex] = useState(0)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [rePickCount, setRePickCount] = useState(0)
  const [showWhy, setShowWhy] = useState(false)

  // Get top candidates (shuffle picks from top 5)
  const candidates = useMemo(
    () => getAlternativeTasks(tasks, null, 5, userEnergy),
    [tasks, userEnergy]
  )

  // Shuffle animation
  useEffect(() => {
    if (!isShuffling) return

    let count = 0
    const shuffleInterval = setInterval(() => {
      setShuffleIndex(prev => (prev + 1) % SHUFFLE_MESSAGES.length)
      count++

      // End shuffle after 5 cycles (about 1.5 seconds)
      if (count >= 5) {
        clearInterval(shuffleInterval)
        setIsShuffling(false)
        // Pick a random task from top 3 candidates
        if (candidates.length > 0) {
          const pickFromTop = Math.min(3, candidates.length)
          const randomIndex = Math.floor(Math.random() * pickFromTop)
          setSelectedTask(candidates[randomIndex])
        }
      }
    }, 300)

    return () => clearInterval(shuffleInterval)
  }, [isShuffling, candidates])

  // Handle re-pick
  const handleRePick = useCallback(() => {
    if (rePickCount >= 2) return // Max 2 re-picks
    setRePickCount(prev => prev + 1)
    setIsShuffling(true)
    setSelectedTask(null)
    setShowWhy(false)
  }, [rePickCount])

  // Handle accepting the pick
  const handleAccept = useCallback(() => {
    if (selectedTask) {
      onSelectTask(selectedTask)
    }
  }, [selectedTask, onSelectTask])

  // Get the reason and encouragement
  const reason = useMemo(
    () => selectedTask ? getTaskPickReason(selectedTask, userEnergy) : '',
    [selectedTask, userEnergy]
  )
  const encouragement = useMemo(() => getEncouragement(reason), [reason])

  // Get first step
  const firstStep = useMemo(() => {
    if (!selectedTask?.steps) return null
    return selectedTask.steps.find(s => !s.done)
  }, [selectedTask])

  // No tasks available
  if (candidates.length === 0) {
    return <NoTasksEmptyState onAction={onCancel} />
  }

  return (
    <div className="fixed inset-0 z-50 bg-canvas/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-elevated border border-border rounded-2xl p-6 max-w-sm w-full shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-text">help me pick</h2>
          <button
            onClick={onCancel}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Close"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shuffling state */}
        {isShuffling && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4 animate-bounce" style={{ animationDuration: '0.5s' }}>
              🎲
            </div>
            <p className="text-text-soft animate-pulse">
              {SHUFFLE_MESSAGES[shuffleIndex]}
            </p>
          </div>
        )}

        {/* Result */}
        {!isShuffling && selectedTask && (
          <div className="animate-rise">
            {/* Encouragement */}
            <p className="text-center text-text-soft text-sm mb-4 italic">
              &ldquo;{encouragement}&rdquo;
            </p>

            {/* Selected task card */}
            <div className="bg-card border border-accent/30 rounded-xl p-4 mb-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-text">{selectedTask.title}</h3>
                {selectedTask.energy && (
                  <EnergyBadge energy={selectedTask.energy} size="sm" />
                )}
              </div>

              {firstStep && (
                <p className="text-sm text-text-soft mb-2">
                  First step: {splitStepText(firstStep.text).title}
                </p>
              )}

              {/* Why this one - expandable */}
              <button
                onClick={() => setShowWhy(!showWhy)}
                className="text-xs text-accent hover:underline flex items-center gap-1"
              >
                {showWhy ? 'hide' : 'why this one?'}
                <svg
                  width={10}
                  height={10}
                  viewBox="0 0 16 16"
                  className={`transition-transform ${showWhy ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              </button>

              {showWhy && (
                <p className="text-xs text-text-muted mt-2 animate-fade-in">
                  {reason}. Selected from your top priorities based on deadline, energy match, and progress.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleAccept}
                className="w-full py-3 rounded-xl bg-accent text-white font-medium hover:opacity-90 transition-opacity active:scale-[0.98]"
              >
                Do this one
              </button>

              <div className="flex items-center justify-center gap-4 text-sm">
                {rePickCount < 2 ? (
                  <button
                    onClick={handleRePick}
                    className="text-text-muted hover:text-text transition-colors py-2"
                  >
                    pick again ({2 - rePickCount} left)
                  </button>
                ) : (
                  <span className="text-text-muted py-2">
                    no more re-picks — trust the process
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
