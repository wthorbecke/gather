'use client'

import { Task, Recurrence } from '@/hooks/useUserData'
import { IntegrationProvider, TaskType, EnergyLevel } from '@/lib/constants'
import { NaggingPrefs } from '@/hooks/useNagging'
import type { LocationTrigger } from '@/lib/location'

interface TaskViewMenuProps {
  task: Task
  theme: 'light' | 'dark'
  naggingPrefs?: NaggingPrefs | null
  addingToCalendar: boolean
  calendarAdded: boolean
  removingFromCalendar: boolean
  calendarRemoved: boolean
  onClose: () => void
  onToggleTheme: () => void
  onShowSnoozeMenu: () => void
  onShowSchedulePicker: () => void
  onShowRecurrencePicker: () => void
  onShowEnergyPicker: () => void
  onShowNaggingSettings: () => void
  onShowDeleteConfirm: () => void
  onOpenLocationTrigger?: () => void
  onAddToCalendar?: () => Promise<{ success: boolean; error?: string }>
  onRemoveFromCalendar?: () => Promise<{ success: boolean; error?: string }>
  onDuplicateTask?: () => void
  onSnoozeTask?: (date: string) => void
  onScheduleTask?: (datetime: string | null) => void
  onSetRecurrence?: (recurrence: Recurrence | null) => void
  onSetEnergy?: (energy: EnergyLevel | null) => void
  onSetNagging?: (taskId: string, enabled: boolean) => void
  setAddingToCalendar: (value: boolean) => void
  setCalendarAdded: (value: boolean) => void
  setRemovingFromCalendar: (value: boolean) => void
  setCalendarRemoved: (value: boolean) => void
}

export function TaskViewMenu({
  task,
  theme,
  naggingPrefs,
  addingToCalendar,
  calendarAdded,
  removingFromCalendar,
  calendarRemoved,
  onClose,
  onToggleTheme,
  onShowSnoozeMenu,
  onShowSchedulePicker,
  onShowRecurrencePicker,
  onShowEnergyPicker,
  onShowNaggingSettings,
  onShowDeleteConfirm,
  onOpenLocationTrigger,
  onAddToCalendar,
  onRemoveFromCalendar,
  onDuplicateTask,
  onSnoozeTask,
  onScheduleTask,
  onSetRecurrence,
  onSetEnergy,
  onSetNagging,
  setAddingToCalendar,
  setCalendarAdded,
  setRemovingFromCalendar,
  setCalendarRemoved,
}: TaskViewMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-md overflow-hidden min-w-[160px] animate-rise">
        <button
          onClick={() => {
            onToggleTheme()
            onClose()
          }}
          className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        {onSnoozeTask && (
          <button
            onClick={() => {
              onClose()
              onShowSnoozeMenu()
            }}
            className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
            aria-label="Snooze task"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            Snooze
          </button>
        )}
        {/* Schedule time - time blocking */}
        {onScheduleTask && (
          <button
            onClick={() => {
              onClose()
              onShowSchedulePicker()
            }}
            className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
            aria-label={task.scheduled_at ? 'Reschedule task' : 'Schedule time for task'}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeLinecap="round" />
            </svg>
            {task.scheduled_at ? 'Reschedule' : 'Schedule time'}
          </button>
        )}
        {/* Set repeat - for reminders and tasks with scheduled_at */}
        {onSetRecurrence && (task.type === TaskType.REMINDER || task.scheduled_at) && (
          <button
            onClick={() => {
              onClose()
              onShowRecurrencePicker()
            }}
            className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
            aria-label={task.recurrence ? 'Edit repeat schedule' : 'Set repeat schedule'}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted" aria-hidden="true">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            {task.recurrence ? 'Edit repeat' : 'Set repeat'}
          </button>
        )}
        {/* Energy level - helps users match tasks to their current energy */}
        {onSetEnergy && (
          <button
            onClick={() => {
              onClose()
              onShowEnergyPicker()
            }}
            className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
            aria-label={task.energy ? 'Change energy level' : 'Set energy level'}
          >
            <span className="text-sm w-4 text-center" aria-hidden="true">
              {task.energy === 'low' ? '🌿' : task.energy === 'medium' ? '⚡' : task.energy === 'high' ? '🔥' : '⚪'}
            </span>
            {task.energy ? 'Change energy' : 'Set energy'}
          </button>
        )}
        {/* Nagging - persistent reminders until done */}
        {onSetNagging && (
          <button
            onClick={() => {
              onClose()
              onShowNaggingSettings()
            }}
            className={`w-full px-3 py-3 min-h-[44px] text-left text-sm hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out ${naggingPrefs?.enabled ? 'text-accent' : 'text-text'}`}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill={naggingPrefs?.enabled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              className={naggingPrefs?.enabled ? 'text-accent' : 'text-text-muted'}
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {naggingPrefs?.enabled ? 'Nagging enabled' : 'Nag me until done'}
          </button>
        )}
        {/* Location trigger - remind at specific places */}
        {onOpenLocationTrigger && (
          <button
            onClick={() => {
              onClose()
              onOpenLocationTrigger()
            }}
            className={`w-full px-3 py-3 min-h-[44px] text-left text-sm hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out ${task.locationTrigger?.enabled ? 'text-accent' : 'text-text'}`}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill={task.locationTrigger?.enabled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              className={task.locationTrigger?.enabled ? 'text-accent' : 'text-text-muted'}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {task.locationTrigger?.enabled ? 'Location reminder set' : 'Remind at location'}
          </button>
        )}
        {/* Calendar options - only show if task has due date and is not from Google */}
        {task.due_date && task.external_source?.provider !== IntegrationProvider.GOOGLE && (
          <>
            {/* Add to Calendar - show if not already added */}
            {onAddToCalendar && !task.calendar_event_id && (
              <button
                onClick={async () => {
                  onClose()
                  setAddingToCalendar(true)
                  const result = await onAddToCalendar()
                  setAddingToCalendar(false)
                  if (result.success) {
                    setCalendarAdded(true)
                    setTimeout(() => setCalendarAdded(false), 3000)
                  }
                }}
                disabled={addingToCalendar || calendarAdded}
                className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out disabled:opacity-50"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  <path d="M12 14v4M10 16h4" strokeLinecap="round" />
                </svg>
                {addingToCalendar ? 'Adding...' : calendarAdded ? 'Added to Calendar' : 'Add to Calendar'}
              </button>
            )}
            {/* Remove from Calendar - show if already added */}
            {onRemoveFromCalendar && task.calendar_event_id && (
              <button
                onClick={async () => {
                  onClose()
                  setRemovingFromCalendar(true)
                  const result = await onRemoveFromCalendar()
                  setRemovingFromCalendar(false)
                  if (result.success) {
                    setCalendarRemoved(true)
                    setTimeout(() => setCalendarRemoved(false), 3000)
                  }
                }}
                disabled={removingFromCalendar || calendarRemoved}
                className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out disabled:opacity-50"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  <path d="M9 15l6-6M9 9l6 6" strokeLinecap="round" />
                </svg>
                {removingFromCalendar ? 'Removing...' : calendarRemoved ? 'Removed' : 'Remove from Calendar'}
              </button>
            )}
          </>
        )}
        {/* Duplicate task */}
        {onDuplicateTask && (
          <button
            onClick={() => {
              onClose()
              onDuplicateTask()
            }}
            className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Duplicate
          </button>
        )}
        <div className="h-px bg-border my-1" />
        <button
          onClick={() => {
            onClose()
            onShowDeleteConfirm()
          }}
          className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2.5 transition-colors duration-150 ease-out"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
          </svg>
          Delete
        </button>
      </div>
    </>
  )
}
