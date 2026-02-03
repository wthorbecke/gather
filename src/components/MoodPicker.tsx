'use client'

import { useState, useCallback } from 'react'
import { EnergyLevel } from '@/lib/constants'

// Mood levels from terrible (1) to great (5)
const MOODS = [
  { value: 1, emoji: '😤', label: 'terrible' },
  { value: 2, emoji: '😕', label: 'not great' },
  { value: 3, emoji: '😐', label: 'okay' },
  { value: 4, emoji: '🙂', label: 'good' },
  { value: 5, emoji: '😊', label: 'great' },
] as const

// Energy levels with friendly labels
const ENERGY_OPTIONS = [
  { value: EnergyLevel.LOW, label: 'Running low', icon: '🔋', sublabel: 'Easy tasks only' },
  { value: EnergyLevel.MEDIUM, label: 'Doing okay', icon: '⚡', sublabel: 'Moderate focus' },
  { value: EnergyLevel.HIGH, label: 'Fully charged', icon: '🚀', sublabel: 'Bring it on' },
] as const

export type MoodValue = 1 | 2 | 3 | 4 | 5

interface MoodPickerProps {
  onSelect: (mood: MoodValue, energy: EnergyLevel) => void
  onDismiss: () => void
}

/**
 * Combined mood and energy picker that appears as an inline banner.
 * Shows once per session to track mood-productivity correlation and
 * match tasks to current energy level.
 *
 * Design: Non-intrusive, dismissible, two-step flow (mood then energy).
 */
export function MoodPicker({ onSelect, onDismiss }: MoodPickerProps) {
  const [hoveredMood, setHoveredMood] = useState<MoodValue | null>(null)
  const [selectedMood, setSelectedMood] = useState<MoodValue | null>(null)
  const [hoveredEnergy, setHoveredEnergy] = useState<EnergyLevel | null>(null)
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [step, setStep] = useState<'mood' | 'energy'>('mood')

  const handleMoodSelect = useCallback((mood: MoodValue) => {
    setSelectedMood(mood)
    // Brief delay for visual feedback before moving to energy
    setTimeout(() => {
      setStep('energy')
    }, 200)
  }, [])

  const handleEnergySelect = useCallback((energy: EnergyLevel) => {
    setSelectedEnergy(energy)
    // Brief delay for visual feedback before triggering callback
    setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => {
        if (selectedMood) {
          onSelect(selectedMood, energy)
        }
      }, 200)
    }, 150)
  }, [onSelect, selectedMood])

  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(onDismiss, 200)
  }, [onDismiss])

  const handleBack = useCallback(() => {
    setStep('mood')
    setSelectedMood(null)
  }, [])

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

          {step === 'mood' ? (
            <>
              {/* Question text - Mood */}
              <p className="text-sm text-text-soft mb-3 pr-6">
                How are you feeling right now?
              </p>

              {/* Emoji row */}
              <div className="flex items-center justify-between gap-2">
                {MOODS.map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    onClick={() => handleMoodSelect(value)}
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
            </>
          ) : (
            <>
              {/* Back button + Question text - Energy */}
              <div className="flex items-center gap-2 mb-3 pr-6">
                <button
                  onClick={handleBack}
                  className="
                    w-6 h-6 -ml-1
                    flex items-center justify-center
                    text-text-muted hover:text-text
                    rounded-full
                    hover:bg-card-hover
                    transition-colors duration-150
                  "
                  aria-label="Go back"
                >
                  <svg width={14} height={14} viewBox="0 0 16 16">
                    <path
                      d="M10 4L6 8L10 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>
                <p className="text-sm text-text-soft">
                  What&apos;s your energy like?
                </p>
              </div>

              {/* Energy options */}
              <div className="flex gap-2">
                {ENERGY_OPTIONS.map(({ value, label, icon, sublabel }) => (
                  <button
                    key={value}
                    onClick={() => handleEnergySelect(value)}
                    onMouseEnter={() => setHoveredEnergy(value)}
                    onMouseLeave={() => setHoveredEnergy(null)}
                    disabled={selectedEnergy !== null}
                    className={`
                      flex-1
                      flex flex-col items-center
                      py-3 px-2
                      rounded-lg
                      border
                      transition-all duration-150
                      ${selectedEnergy === value
                        ? 'bg-accent/20 border-accent/40 scale-105'
                        : selectedEnergy !== null
                          ? 'opacity-40 border-border-subtle'
                          : 'border-border-subtle hover:border-border hover:bg-card-hover active:scale-95'
                      }
                    `}
                    aria-label={label}
                  >
                    <span
                      className={`
                        text-xl mb-1
                        transition-transform duration-150
                        ${hoveredEnergy === value && selectedEnergy === null ? 'scale-125' : ''}
                      `}
                      role="img"
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                    <span className="text-sm font-medium text-text">
                      {label}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5">
                      {sublabel}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Session storage keys for tracking mood/energy shown this session
export const MOOD_SESSION_KEY = 'gather:mood_shown_session'
export const ENERGY_SESSION_KEY = 'gather:session_energy'

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

/**
 * Store the session energy level
 */
export function setSessionEnergy(energy: EnergyLevel): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(ENERGY_SESSION_KEY, energy)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the stored session energy level
 */
export function getSessionEnergy(): EnergyLevel | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(ENERGY_SESSION_KEY)
    if (stored === EnergyLevel.LOW || stored === EnergyLevel.MEDIUM || stored === EnergyLevel.HIGH) {
      return stored
    }
    return null
  } catch {
    return null
  }
}
