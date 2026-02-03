'use client'

import { useState, useCallback } from 'react'

// Mood levels from terrible (1) to great (5)
const MOODS = [
  { value: 1, emoji: '😤', label: 'terrible' },
  { value: 2, emoji: '😕', label: 'not great' },
  { value: 3, emoji: '😐', label: 'okay' },
  { value: 4, emoji: '🙂', label: 'good' },
  { value: 5, emoji: '😊', label: 'great' },
] as const

export type MoodValue = 1 | 2 | 3 | 4 | 5

interface MoodPickerProps {
  onSelect: (mood: MoodValue) => void
  onDismiss: () => void
}

/**
 * Simple mood picker that appears as an inline banner.
 * Shows once per session to track mood-productivity correlation.
 *
 * Design: Non-intrusive, dismissible, uses emoji scale.
 */
export function MoodPicker({ onSelect, onDismiss }: MoodPickerProps) {
  const [hoveredMood, setHoveredMood] = useState<MoodValue | null>(null)
  const [selectedMood, setSelectedMood] = useState<MoodValue | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  const handleSelect = useCallback((mood: MoodValue) => {
    setSelectedMood(mood)
    // Brief delay for visual feedback before triggering callback
    setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => {
        onSelect(mood)
      }, 200)
    }, 150)
  }, [onSelect])

  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(onDismiss, 200)
  }, [onDismiss])

  return (
    <div
      className={`
        px-5 mb-4
        ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}
      `}
    >
      <div className="max-w-[540px] mx-auto">
        <div className="
          relative
          p-4
          bg-surface
          border border-border-subtle
          rounded-xl
        ">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="
              absolute top-3 right-3
              w-6 h-6
              flex items-center justify-center
              text-text-muted hover:text-text-soft
              rounded-full
              hover:bg-surface
              transition-colors duration-150
            "
            aria-label="Dismiss"
          >
            <svg width={12} height={12} viewBox="0 0 16 16">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Question text */}
          <p className="text-sm text-text-soft mb-3 pr-6">
            How are you feeling right now?
          </p>

          {/* Emoji row */}
          <div className="flex items-center justify-between gap-2">
            {MOODS.map(({ value, emoji, label }) => (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                onMouseEnter={() => setHoveredMood(value)}
                onMouseLeave={() => setHoveredMood(null)}
                disabled={selectedMood !== null}
                className={`
                  flex-1
                  flex flex-col items-center
                  py-2 px-1
                  rounded-lg
                  transition-all duration-150
                  ${selectedMood === value
                    ? 'bg-accent/20 scale-110'
                    : selectedMood !== null
                      ? 'opacity-40'
                      : 'hover:bg-surface hover:scale-105 active:scale-95'
                  }
                `}
                aria-label={label}
              >
                <span
                  className={`
                    text-2xl
                    transition-transform duration-150
                    ${hoveredMood === value && selectedMood === null ? 'scale-125' : ''}
                  `}
                  role="img"
                  aria-hidden="true"
                >
                  {emoji}
                </span>
                {/* Show label on hover or selection */}
                <span
                  className={`
                    text-[10px] text-text-muted mt-1
                    transition-opacity duration-150
                    ${(hoveredMood === value || selectedMood === value) ? 'opacity-100' : 'opacity-0'}
                  `}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Session storage key for tracking if mood was already shown this session
export const MOOD_SESSION_KEY = 'gather:mood_shown_session'

/**
 * Check if mood picker should be shown this session
 */
export function shouldShowMoodPicker(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(MOOD_SESSION_KEY) !== 'true'
  } catch {
    return false
  }
}

/**
 * Mark mood picker as shown for this session
 */
export function markMoodPickerShown(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(MOOD_SESSION_KEY, 'true')
  } catch {
    // Ignore storage errors
  }
}
