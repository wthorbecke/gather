'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Step } from '@/hooks/useUserData'
import { Checkbox } from './Checkbox'
import { splitStepText } from '@/lib/stepText'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAmbientSound, AmbientSoundType } from '@/hooks/useAmbientSound'

// Sound type labels for display
const SOUND_LABELS: Record<AmbientSoundType, string> = {
  off: 'Sound off',
  white: 'White noise',
  brown: 'Brown noise',
  rain: 'Rain',
}

// Sound icons
const SOUND_ICONS: Record<AmbientSoundType, string> = {
  off: '🔇',
  white: '〰️',
  brown: '🌊',
  rain: '🌧️',
}

// Pomodoro constants
const POMODORO_WORK_SECONDS = 25 * 60 // 25 minutes
const POMODORO_SHORT_BREAK_SECONDS = 5 * 60 // 5 minutes
const POMODORO_LONG_BREAK_SECONDS = 15 * 60 // 15 minutes
const POMODOROS_UNTIL_LONG_BREAK = 4

type TimerMode = 'stopwatch' | 'pomodoro'
type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak'

interface FocusModeProps {
  step: Step
  taskTitle: string
  totalSteps: number
  currentStepIndex: number
  onToggleStep: () => void
  onExit: () => void
  onNext?: () => void
  onPrevious?: () => void
  onStuck?: () => void
}

/**
 * Full-screen focus mode for a single step
 * Removes all distractions and guides the user through one thing at a time
 */
export function FocusMode({
  step,
  taskTitle,
  totalSteps,
  currentStepIndex,
  onToggleStep,
  onExit,
  onNext,
  onPrevious,
  onStuck,
}: FocusModeProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)

  // Ambient sound
  const { soundType, toggleSound } = useAmbientSound()

  // Pomodoro state
  const [timerMode, setTimerMode] = useState<TimerMode>('stopwatch')
  const [pomodoroTime, setPomodoroTime] = useState(POMODORO_WORK_SECONDS)
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('work')
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [showBreakPrompt, setShowBreakPrompt] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)

  // Timer that counts up (stopwatch mode)
  useEffect(() => {
    if (!isTimerRunning || timerMode !== 'stopwatch') return
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isTimerRunning, timerMode])

  // Timer that counts down (pomodoro mode)
  useEffect(() => {
    if (!isTimerRunning || timerMode !== 'pomodoro') return
    const interval = setInterval(() => {
      setPomodoroTime(prev => {
        if (prev <= 1) {
          // Timer complete
          setIsTimerRunning(false)
          setIsPulsing(true)
          setTimeout(() => setIsPulsing(false), 3000)

          if (pomodoroPhase === 'work') {
            const newCount = pomodoroCount + 1
            setPomodoroCount(newCount)
            setShowBreakPrompt(true)
          } else {
            // Break complete, back to work
            setPomodoroPhase('work')
            return POMODORO_WORK_SECONDS
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isTimerRunning, timerMode, pomodoroPhase, pomodoroCount])

  // Start break
  const startBreak = useCallback((isLongBreak: boolean) => {
    setShowBreakPrompt(false)
    setPomodoroPhase(isLongBreak ? 'longBreak' : 'shortBreak')
    setPomodoroTime(isLongBreak ? POMODORO_LONG_BREAK_SECONDS : POMODORO_SHORT_BREAK_SECONDS)
    setIsTimerRunning(true)
  }, [])

  // Skip break and continue working
  const skipBreak = useCallback(() => {
    setShowBreakPrompt(false)
    setPomodoroPhase('work')
    setPomodoroTime(POMODORO_WORK_SECONDS)
    setIsTimerRunning(true)
  }, [])

  // Toggle timer mode
  const toggleTimerMode = useCallback(() => {
    setTimerMode(prev => {
      if (prev === 'stopwatch') {
        // Switching to pomodoro, reset pomodoro timer
        setPomodoroTime(POMODORO_WORK_SECONDS)
        setPomodoroPhase('work')
        return 'pomodoro'
      } else {
        // Switching to stopwatch
        return 'stopwatch'
      }
    })
  }, [])

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      key: 'Escape',
      action: onExit,
      description: 'Exit focus mode',
    },
    {
      key: 'Enter',
      action: () => {
        onToggleStep()
        if (!step.done && onNext) {
          setTimeout(onNext, 300)
        }
      },
      description: 'Mark step complete',
    },
    {
      key: 'ArrowRight',
      action: () => onNext?.(),
      description: 'Next step',
    },
    {
      key: 'ArrowLeft',
      action: () => onPrevious?.(),
      description: 'Previous step',
    },
    {
      key: 'd',
      action: () => setShowDetails(prev => !prev),
      description: 'Toggle details',
    },
    {
      key: ' ',
      action: () => setIsTimerRunning(prev => !prev),
      description: 'Pause/resume timer',
    },
    {
      key: 'p',
      action: toggleTimerMode,
      description: 'Toggle pomodoro',
    },
    {
      key: 's',
      action: toggleSound,
      description: 'Cycle ambient sound',
    },
  ], [onExit, onToggleStep, onNext, onPrevious, step.done, toggleTimerMode, toggleSound])

  useKeyboardShortcuts({ shortcuts, enabled: !showBreakPrompt })

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const { title, remainder } = splitStepText(step.text)
  const hasDetail = Boolean(remainder || step.detail || step.summary)

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <button
          onClick={onExit}
          className="text-sm text-text-muted hover:text-text transition-colors duration-150 ease-out flex items-center gap-1.5 btn-press tap-target"
        >
          <svg width={16} height={16} viewBox="0 0 16 16">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          Exit focus
        </button>

        <div className="text-sm text-text-muted tabular-nums">
          Step {currentStepIndex + 1} of {totalSteps}
        </div>

        {/* Timer and keyboard hint */}
        <div className="flex items-center gap-1">
          {/* Timer mode toggle */}
          <button
            onClick={toggleTimerMode}
            className={`
              px-2 py-1 min-h-[36px] rounded-lg text-xs font-medium
              transition-all duration-150 ease-out
              ${timerMode === 'pomodoro'
                ? 'bg-accent/20 text-accent'
                : 'text-text-muted hover:text-text hover:bg-surface'
              }
            `}
            aria-label={timerMode === 'pomodoro' ? 'Switch to stopwatch' : 'Switch to pomodoro'}
            title="Press P to toggle"
          >
            {timerMode === 'pomodoro' ? '🍅' : '⏱️'}
          </button>

          {/* Timer display */}
          <button
            onClick={() => setIsTimerRunning(prev => !prev)}
            className={`
              font-mono text-sm tabular-nums min-w-[60px] min-h-[44px]
              flex items-center justify-center rounded-lg
              hover:bg-surface transition-all duration-150 ease-out
              ${isPulsing ? 'animate-pulse bg-accent/20' : ''}
              ${isTimerRunning
                ? timerMode === 'pomodoro' && pomodoroPhase !== 'work' ? 'text-success' : 'text-accent'
                : 'text-text-muted'
              }
            `}
            aria-label={isTimerRunning ? 'Pause timer' : 'Resume timer'}
          >
            {timerMode === 'pomodoro' ? formatTime(pomodoroTime) : formatTime(elapsedTime)}
          </button>

          {/* Pomodoro count */}
          {timerMode === 'pomodoro' && pomodoroCount > 0 && (
            <div className="text-xs text-text-muted px-1">
              {pomodoroCount}🍅
            </div>
          )}

          {/* Ambient sound toggle */}
          <button
            onClick={toggleSound}
            className={`
              px-2 py-1 min-h-[36px] rounded-lg text-sm
              transition-all duration-150 ease-out
              ${soundType !== 'off'
                ? 'bg-success/20 text-success'
                : 'text-text-muted hover:text-text hover:bg-surface'
              }
            `}
            aria-label={SOUND_LABELS[soundType]}
            title={`${SOUND_LABELS[soundType]} (Press S to change)`}
          >
            {SOUND_ICONS[soundType]}
          </button>

          <div className="group relative">
            <button className="text-text-muted hover:text-text transition-colors duration-150 ease-out min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-surface" aria-label="Keyboard shortcuts">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" strokeLinecap="round" />
              </svg>
            </button>
            <div className="
              absolute right-0 top-full mt-2
              bg-card border border-border rounded-lg shadow-elevated
              p-3 min-w-[180px]
              opacity-0 invisible
              group-hover:opacity-100 group-hover:visible
              transition-all z-10
            ">
              <div className="text-xs font-medium text-text-muted mb-2">Keyboard shortcuts</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-text-soft">Complete</span><span className="text-text-muted">Enter</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Next</span><span className="text-text-muted">→</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Previous</span><span className="text-text-muted">←</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Details</span><span className="text-text-muted">D</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Pause timer</span><span className="text-text-muted">Space</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Pomodoro</span><span className="text-text-muted">P</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Sound</span><span className="text-text-muted">S</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Exit</span><span className="text-text-muted">Esc</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-xl mx-auto">
        {/* Task title */}
        <div className="text-sm text-text-muted mb-8 text-center">{taskTitle}</div>

        {/* Step content */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-text leading-relaxed mb-4">
            {title}
          </h1>

          {hasDetail && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="
                inline-flex items-center gap-1.5
                px-3 py-1.5
                text-sm text-text-soft
                bg-subtle hover:bg-surface
                rounded-full
                transition-colors
              "
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 16 16"
                className={`transition-transform duration-150 ${showDetails ? 'rotate-180' : ''}`}
              >
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          )}

          {showDetails && (
            <div className="mt-4 text-base text-text-soft animate-fade-in">
              {remainder || step.detail || step.summary}
            </div>
          )}
        </div>

        {/* Time estimate */}
        {step.time && (
          <div className="text-sm text-text-muted mb-8 flex items-center gap-2">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            {step.time}
          </div>
        )}

        {/* Action button */}
        <div className="mb-8">
          <button
            onClick={() => {
              onToggleStep()
              if (!step.done && onNext) {
                setTimeout(onNext, 300)
              }
            }}
            className={`
              flex items-center gap-4
              p-6 rounded-xl
              transition-all duration-150 ease-out
              ${step.done
                ? 'bg-success/10 border-2 border-success'
                : 'bg-card border-2 border-border hover:border-accent'
              }
            `}
          >
            <Checkbox checked={step.done} onToggle={() => {}} size={32} />
            <span className={`text-lg font-medium ${step.done ? 'text-success' : 'text-text'}`}>
              {step.done ? 'Done!' : 'Mark as done'}
            </span>
          </button>
        </div>

        {/* Stuck button */}
        {onStuck && !step.done && (
          <button
            onClick={onStuck}
            className="text-sm text-text-muted hover:text-accent transition-colors duration-150 ease-out mb-4 btn-press tap-target"
          >
            I&apos;m stuck on this step
          </button>
        )}
      </div>

      {/* Navigation footer */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        <button
          onClick={onPrevious}
          disabled={currentStepIndex === 0}
          className="p-2 min-w-[44px] min-h-[44px] text-text-soft hover:text-text transition-colors duration-150 ease-out disabled:opacity-30 disabled:cursor-not-allowed btn-press"
          aria-label="Previous step"
        >
          <svg width={20} height={20} viewBox="0 0 16 16">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>

        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-150 ease-out ${
                i === currentStepIndex
                  ? 'bg-accent'
                  : i < currentStepIndex
                  ? 'bg-success'
                  : 'bg-border'
              }`}
            />
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={currentStepIndex === totalSteps - 1}
          className="p-2 min-w-[44px] min-h-[44px] text-text-soft hover:text-text transition-colors duration-150 ease-out disabled:opacity-30 disabled:cursor-not-allowed btn-press"
          aria-label="Next step"
        >
          <svg width={20} height={20} viewBox="0 0 16 16">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </div>

      {/* Break Prompt Modal */}
      {showBreakPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/95 backdrop-blur-sm animate-fade-in">
          <div className="bg-elevated border border-border rounded-2xl p-8 max-w-sm mx-4 text-center shadow-modal">
            <div className="text-4xl mb-4">🍅</div>
            <h2 className="text-xl font-semibold text-text mb-2">
              Pomodoro complete!
            </h2>
            <p className="text-text-soft mb-6">
              You&apos;ve done {pomodoroCount} {pomodoroCount === 1 ? 'pomodoro' : 'pomodoros'}. Time for a break?
            </p>

            <div className="space-y-3">
              {pomodoroCount % POMODOROS_UNTIL_LONG_BREAK === 0 ? (
                <>
                  <button
                    onClick={() => startBreak(true)}
                    className="w-full p-3 rounded-lg bg-success text-white font-medium hover:bg-success/90 transition-all duration-150 ease-out btn-press"
                  >
                    Long break (15 min)
                  </button>
                  <button
                    onClick={() => startBreak(false)}
                    className="w-full p-3 rounded-lg bg-subtle text-text-soft hover:bg-surface transition-all duration-150 ease-out btn-press"
                  >
                    Short break (5 min)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => startBreak(false)}
                  className="w-full p-3 rounded-lg bg-success text-white font-medium hover:bg-success/90 transition-all duration-150 ease-out btn-press"
                >
                  Take a break (5 min)
                </button>
              )}

              <button
                onClick={skipBreak}
                className="w-full p-3 rounded-lg text-text-muted hover:text-text transition-colors duration-150 ease-out"
              >
                Skip break, keep going
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
