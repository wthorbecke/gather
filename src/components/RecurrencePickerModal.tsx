'use client'

import { useState } from 'react'
import { RecurrenceFrequency } from '@/lib/constants'
import { Recurrence } from '@/hooks/useUserData'

interface RecurrencePickerModalProps {
  currentRecurrence: Recurrence | null | undefined
  onSave: (recurrence: Recurrence | null) => void
  onCancel: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export function RecurrencePickerModal({
  currentRecurrence,
  onSave,
  onCancel,
}: RecurrencePickerModalProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency | 'none'>(
    currentRecurrence?.frequency || 'none'
  )
  const [selectedDays, setSelectedDays] = useState<number[]>(
    currentRecurrence?.days || []
  )

  const handleSave = () => {
    if (frequency === 'none') {
      onSave(null)
    } else {
      onSave({
        frequency,
        days: frequency === 'weekly' ? selectedDays : undefined,
      })
    }
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-10 bg-elevated border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm mx-0 sm:mx-4 p-4 shadow-modal animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Repeat</h2>
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

        {/* Frequency options */}
        <div className="space-y-2 mb-4">
          {[
            { value: 'none' as const, label: 'No repeat', description: 'One-time only' },
            { value: 'daily' as RecurrenceFrequency, label: 'Daily', description: 'Every day' },
            { value: 'weekly' as RecurrenceFrequency, label: 'Weekly', description: 'Same day each week' },
            { value: 'monthly' as RecurrenceFrequency, label: 'Monthly', description: 'Same date each month' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFrequency(option.value)}
              className={`
                w-full text-left p-3 rounded-xl transition-all flex items-center justify-between
                ${frequency === option.value
                  ? 'bg-accent/10 border-2 border-accent'
                  : 'bg-surface border border-border hover:border-accent/50'
                }
              `}
            >
              <div>
                <div className="font-medium text-text">{option.label}</div>
                <div className="text-sm text-text-muted">{option.description}</div>
              </div>
              {frequency === option.value && (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Day selector for weekly */}
        {frequency === 'weekly' && (
          <div className="mb-4">
            <div className="text-sm font-medium text-text-soft mb-2">Repeat on</div>
            <div className="flex gap-1 justify-between">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`
                    w-10 h-10 rounded-full text-sm font-medium transition-colors
                    ${selectedDays.includes(day.value)
                      ? 'bg-accent text-white'
                      : 'bg-surface text-text-soft hover:bg-surface/80'
                    }
                  `}
                >
                  {day.label[0]}
                </button>
              ))}
            </div>
            {selectedDays.length === 0 && (
              <p className="text-xs text-text-muted mt-2">
                Select at least one day, or it will repeat on the original day
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-surface text-text-soft rounded-xl font-medium hover:bg-surface/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
