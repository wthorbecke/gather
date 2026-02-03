'use client'

import { useCallback, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { User } from '@supabase/supabase-js'
import { useTasks, Task, Step, useMoodEntries } from '@/hooks/useUserData'
import { MoodPicker, shouldShowMoodPicker, markMoodPickerShown, type MoodValue } from './MoodPicker'
import { mapAIStepsToSteps } from '@/lib/taskHelpers'
import { useMemory } from '@/hooks/useMemory'
import { useUndo, type UndoAction } from '@/hooks/useUndo'
import { UndoToast } from './UndoToast'
import { useViewState } from '@/hooks/useViewState'
import { useTaskNavigation } from '@/hooks/useTaskNavigation'
import { useCelebration } from '@/hooks/useCelebration'
import { useAIConversation } from '@/hooks/useAIConversation'
import { useGlobalKeyboardShortcuts } from '@/hooks/useGlobalKeyboardShortcuts'
import { useStepHandlers } from '@/hooks/useStepHandlers'
import { GatherAppSkeleton } from './GatherAppSkeleton'
import { ThemeToggle } from './ThemeProvider'
import { HomeView } from './HomeView'
import { StackView } from './StackView'
import { DayView } from './DayView'
import { TaskView } from './TaskView'
import { ErrorBoundary } from './ErrorBoundary'
import { ChatModal } from './ChatModal'
import { ViewToggle } from './ViewToggle'
import { calculateNewStreak, isHabitCompletedToday } from '@/lib/taskTypes'
import { authFetch } from '@/lib/supabase'
import { EnergyLevel } from '@/lib/constants'

// Lazy load heavy components that are not needed immediately
const Confetti = dynamic(() => import('./Confetti').then(mod => ({ default: mod.Confetti })), {
  ssr: false,
  loading: () => null,
})
const CompletionCelebration = dynamic(() => import('./Confetti').then(mod => ({ default: mod.CompletionCelebration })), {
  ssr: false,
  loading: () => null,
})
const IntegrationSettings = dynamic(() => import('./IntegrationSettings').then(mod => ({ default: mod.IntegrationSettings })), {
  ssr: false,
  loading: () => <div className="animate-pulse p-8 text-center text-text-muted">Loading settings...</div>,
})
const UpgradeModal = dynamic(() => import('./UpgradeModal').then(mod => ({ default: mod.UpgradeModal })), {
  ssr: false,
  loading: () => null,
})
const KeyboardShortcutsModal = dynamic(() => import('./KeyboardShortcutsModal').then(mod => ({ default: mod.KeyboardShortcutsModal })), {
  ssr: false,
  loading: () => null,
})
const TaskTemplateModal = dynamic(() => import('./TaskTemplateModal').then(mod => ({ default: mod.TaskTemplateModal })), {
  ssr: false,
  loading: () => null,
})
const FocusLauncher = dynamic(() => import('./FocusLauncher').then(mod => ({ default: mod.FocusLauncher })), {
  ssr: false,
  loading: () => null,
})
const HelpMePick = dynamic(() => import('./HelpMePick').then(mod => ({ default: mod.HelpMePick })), {
  ssr: false,
  loading: () => null,
})
const BrainDumpModal = dynamic(() => import('./BrainDumpModal').then(mod => ({ default: mod.BrainDumpModal })), {
  ssr: false,
  loading: () => null,
})
const ContextCaptureModal = dynamic(() => import('./ContextCaptureModal').then(mod => ({ default: mod.ContextCaptureModal })), {
  ssr: false,
  loading: () => null,
})

// Minimum time spent (30 seconds) before prompting for context note
const MIN_TIME_FOR_CONTEXT_PROMPT = 30 * 1000

interface GatherAppProps {
  user: User
  onSignOut: () => void
}

export function GatherApp({ user, onSignOut }: GatherAppProps) {
  // Data hooks
  const { tasks, addTask, updateTask, toggleStep, deleteTask, restoreTask, loading } = useTasks(user)
  const { addEntry, addToConversation, getMemoryForAI, getRelevantMemory, getPreference, setPreference } = useMemory()
  const { moodEntries, addMoodEntry } = useMoodEntries()
  const isDemoUser = Boolean(user?.id?.startsWith('demo-') || user?.email?.endsWith('@gather.local'))

  // Mood picker state - only show once per session
  const [showMoodPicker, setShowMoodPicker] = useState(false)

  // Check if we should show mood picker on mount
  useEffect(() => {
    if (!loading && shouldShowMoodPicker()) {
      setShowMoodPicker(true)
    }
  }, [loading])

  // Handle mood selection
  const handleMoodSelect = useCallback((mood: MoodValue) => {
    addMoodEntry(mood)
    markMoodPickerShown()
    setShowMoodPicker(false)
  }, [addMoodEntry])

  // Handle mood picker dismissal
  const handleMoodDismiss = useCallback(() => {
    markMoodPickerShown()
    setShowMoodPicker(false)
  }, [])

  // Chat modal state
  const [showChatModal, setShowChatModal] = useState(false)

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Keyboard shortcuts modal state
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)

  // Task template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  // Focus launcher state
  const [showFocusLauncher, setShowFocusLauncher] = useState(false)

  // Help me pick state
  const [showHelpMePick, setShowHelpMePick] = useState(false)

  // Brain dump modal state
  const [showBrainDump, setShowBrainDump] = useState(false)

  // Context capture modal state (for "where I left off" notes)
  const [showContextCapture, setShowContextCapture] = useState(false)
  const [contextCaptureTask, setContextCaptureTask] = useState<Task | null>(null)
  const [taskViewStartTime, setTaskViewStartTime] = useState<number | null>(null)

  // View state
  const {
    currentTaskId,
    showIntegrationSettings,
    useStackView,
    viewMode,
    selectedDate,
    setCurrentTaskId,
    setShowIntegrationSettings,
    setUseStackView,
    setViewMode,
    setSelectedDate,
  } = useViewState()

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    onShowKeyboardShortcuts: () => setShowKeyboardShortcuts(true),
    onHideKeyboardShortcuts: () => setShowKeyboardShortcuts(false),
    onShowFocusLauncher: () => setShowFocusLauncher(true),
    onHideFocusLauncher: () => setShowFocusLauncher(false),
    onShowHelpMePick: () => setShowHelpMePick(true),
    onHideHelpMePick: () => setShowHelpMePick(false),
    onShowBrainDump: () => setShowBrainDump(true),
    onHideBrainDump: () => setShowBrainDump(false),
    showKeyboardShortcuts,
    showFocusLauncher,
    showHelpMePick,
    showBrainDump,
    currentTaskId,
  })

  // Task navigation
  const {
    contextTags,
    focusStepId,
    goToTask: navGoToTask,
    goHome: navGoHome,
    setStepContext,
    removeTag,
    setFocusStepId,
    clearContextTags,
  } = useTaskNavigation()

  // Celebration state
  const {
    showConfetti,
    completedTaskName,
    dismissConfetti,
    dismissCelebration,
    checkAndCelebrate,
  } = useCelebration()

  // Undo functionality
  const handleUndoAction = useCallback(async (action: UndoAction) => {
    if (action.type === 'delete_task' && action.data.previousState) {
      await restoreTask(action.data.previousState as Task)
    } else if (action.type === 'toggle_step' && action.data.stepId !== undefined) {
      await toggleStep(action.data.taskId, action.data.stepId)
    }
  }, [restoreTask, toggleStep])

  const { pendingUndo, pushUndo, executeUndo, dismissUndo } = useUndo(handleUndoAction)

  // Step handlers - consolidated from useStepHandlers hook
  const {
    handleToggleStep,
    handleEditStep,
    handleDeleteStep,
    handleAddStep,
    handleMoveStep,
  } = useStepHandlers({
    tasks,
    toggleStep,
    updateTask,
    checkAndCelebrate,
    pushUndo,
    addEntry,
  })

  // AI conversation - pass dependencies
  const aiConversation = useAIConversation({
    tasks,
    currentTaskId,
    contextTags,
    addTask,
    updateTask,
    toggleStep,
    addEntry,
    addToConversation,
    getMemoryForAI,
    getRelevantMemory,
    getPreference,
    setPreference,
    goToTask: navGoToTask,
    setCurrentTaskId,
    useStackView,
    onUpgradeRequired: () => setShowUpgradeModal(true),
  })

  const {
    aiCard,
    pendingInput,
    contextGathering,
    setAiCard,
    handleSubmit,
    handleQuickReply,
    handleBackQuestion,
    handleAICardAction: baseHandleAICardAction,
    dismissAI,
    clearConversation,
  } = aiConversation

  const currentTask = tasks.find((t) => t.id === currentTaskId)

  // Track when entering a task view
  useEffect(() => {
    if (currentTaskId) {
      setTaskViewStartTime(Date.now())
    } else {
      setTaskViewStartTime(null)
    }
  }, [currentTaskId])

  // Check if we should prompt for a context note when leaving a task
  const checkForContextPrompt = useCallback((task: Task | undefined) => {
    if (!task || !taskViewStartTime) return false

    const timeSpent = Date.now() - taskViewStartTime

    // Only prompt if:
    // 1. User spent at least 30 seconds on the task
    // 2. Task has incomplete steps (still in progress)
    // 3. Task doesn't already have a "where I left off" note
    const hasIncompleteSteps = task.steps?.some(s => !s.done)
    const hasExistingNote = Boolean(task.notes?.trim())

    return timeSpent >= MIN_TIME_FOR_CONTEXT_PROMPT && hasIncompleteSteps && !hasExistingNote
  }, [taskViewStartTime])

  // Navigate to task - combines navigation with AI state cleanup
  const goToTask = useCallback((taskId: string) => {
    // Check if we should prompt for context note before navigating away
    if (currentTask && checkForContextPrompt(currentTask)) {
      setContextCaptureTask(currentTask)
      setShowContextCapture(true)
      // Store the target task ID to navigate after modal is handled
      return
    }

    navGoToTask(taskId, tasks)
    setCurrentTaskId(taskId)
    clearConversation()
  }, [navGoToTask, tasks, setCurrentTaskId, clearConversation, currentTask, checkForContextPrompt])

  // Go back to home - combines navigation with AI state cleanup
  const goHome = useCallback(() => {
    // Check if we should prompt for context note before navigating away
    if (currentTask && checkForContextPrompt(currentTask)) {
      setContextCaptureTask(currentTask)
      setShowContextCapture(true)
      return
    }

    setCurrentTaskId(null)
    navGoHome()
    clearConversation()
    clearContextTags()
  }, [setCurrentTaskId, navGoHome, clearConversation, clearContextTags, currentTask, checkForContextPrompt])

  // Complete the navigation after context capture is handled
  const completeNavigation = useCallback(() => {
    setShowContextCapture(false)
    setContextCaptureTask(null)
    setCurrentTaskId(null)
    navGoHome()
    clearConversation()
    clearContextTags()
  }, [setCurrentTaskId, navGoHome, clearConversation, clearContextTags])

  // Save context note and complete navigation
  const handleSaveContextNote = useCallback(async (note: string) => {
    if (contextCaptureTask) {
      await updateTask(contextCaptureTask.id, { notes: note })
    }
    completeNavigation()
  }, [contextCaptureTask, updateTask, completeNavigation])

  // Skip context note and complete navigation
  const handleSkipContextNote = useCallback(() => {
    completeNavigation()
  }, [completeNavigation])

  // Clear the "where I left off" note
  const handleClearLeftOffNote = useCallback(async (taskId: string) => {
    await updateTask(taskId, { notes: null })
  }, [updateTask])

  // Handle quick add - creates task immediately, then generates AI steps in background
  const handleQuickAdd = useCallback(async (value: string, metadata?: { type?: string; scheduledAt?: Date | null; dueDate?: Date | null }) => {
    const taskType = (metadata?.type as import('@/lib/constants').TaskType) || undefined
    const scheduledAt = metadata?.scheduledAt?.toISOString() || null
    const dueDate = metadata?.dueDate?.toISOString() || null

    const newTask = await addTask(
      value,
      'soon',
      undefined, // description
      undefined, // badge
      undefined, // clarifyingAnswers
      undefined, // taskCategory
      dueDate,   // dueDate - extracted from natural language
      taskType,
      scheduledAt
    )

    if (newTask) {
      // Skip AI steps for reminders/events - they don't need breakdown
      if (taskType === 'reminder' || taskType === 'event') {
        return
      }

      // Add a placeholder step immediately so the task doesn't look empty
      const placeholderStep = { id: `step-${Date.now()}`, text: 'Breaking this down...', done: false }
      try {
        await updateTask(newTask.id, {
          steps: [placeholderStep],
        } as Partial<Task>)
      } catch {
        // Steps column may need migration
      }

      // Generate AI steps in the background
      try {
        const response = await fetch('/api/suggest-subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: value,
            description: '',
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const aiSteps = mapAIStepsToSteps(data.subtasks || [])

          // Update with real AI-generated steps
          if (aiSteps.length > 0) {
            await updateTask(newTask.id, { steps: aiSteps } as Partial<Task>)
          }
        }
      } catch {
        // If AI fails, keep the placeholder - user can manually add steps
      }
    }
  }, [addTask, updateTask])

  // Handle template selection
  const handleSelectTemplate = useCallback(async (template: { title: string; steps: Step[] }) => {
    setShowTemplateModal(false)

    // Create the task
    const newTask = await addTask(
      template.title,
      'soon',
      undefined, // description
      undefined, // badge
      undefined, // clarifyingAnswers
      undefined, // taskCategory
      null,      // dueDate
      'task',    // taskType
      null       // scheduledAt
    )

    if (newTask) {
      // Update with template steps (re-generate IDs to ensure uniqueness)
      const stepsWithNewIds = template.steps.map((step, idx) => ({
        ...step,
        id: `step-${Date.now()}-${idx}`,
        done: false, // Reset done state for new task
      }))

      await updateTask(newTask.id, { steps: stepsWithNewIds } as Partial<Task>)

      // Navigate to the task to show it
      goToTask(newTask.id)
    }
  }, [addTask, updateTask, goToTask])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSubmit(suggestion)
  }, [handleSubmit])

  // Delete task with undo support
  const handleDeleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    const deletedTask = await deleteTask(taskId)
    goHome() // Navigate back home after deletion

    // Push undo action if we have the deleted task data
    if (deletedTask) {
      pushUndo({
        type: 'delete_task',
        description: `Deleted "${task?.title || 'task'}"`,
        data: {
          taskId,
          previousState: deletedTask,
        },
      })
    }
  }, [deleteTask, goHome, tasks, pushUndo])

  // Snooze task
  const handleSnoozeTask = useCallback(async (taskId: string, snoozedUntil: string) => {
    await updateTask(taskId, { snoozed_until: snoozedUntil } as Partial<Task>)
    goHome() // Navigate back home after snoozing
  }, [updateTask, goHome])

  // Schedule task (time blocking)
  const handleScheduleTask = useCallback(async (taskId: string, scheduledAt: string | null) => {
    await updateTask(taskId, { scheduled_at: scheduledAt } as Partial<Task>)
  }, [updateTask])

  // Set recurrence on a task
  const handleSetRecurrence = useCallback(async (taskId: string, recurrence: import('@/hooks/useUserData').Recurrence | null) => {
    await updateTask(taskId, { recurrence } as Partial<Task>)
  }, [updateTask])

  // Set energy level on a task
  const handleSetEnergy = useCallback(async (taskId: string, energy: EnergyLevel | null) => {
    await updateTask(taskId, { energy } as Partial<Task>)
  }, [updateTask])

  // Duplicate a task
  const handleDuplicateTask = useCallback(async (task: Task) => {
    // Create a new task with the same properties
    // Convert null values to undefined to match addTask signature
    const newTask = await addTask(
      task.title,
      'soon',
      task.description ?? undefined,
      task.badge ?? undefined,
      task.clarifying_answers || [],
      task.category ?? undefined,
      task.due_date,
      task.type,
      task.scheduled_at
    )

    if (newTask) {
      // Copy steps with new IDs (reset done state)
      if (task.steps && task.steps.length > 0) {
        const duplicatedSteps = task.steps.map((step, idx) => ({
          ...step,
          id: `step-${Date.now()}-${idx}`,
          done: false, // Reset completion
        }))
        await updateTask(newTask.id, { steps: duplicatedSteps } as Partial<Task>)
      }

      // Copy context_text if present
      if (task.context_text) {
        await updateTask(newTask.id, { context_text: task.context_text } as Partial<Task>)
      }

      // Navigate to the new task
      goToTask(newTask.id)
    }
  }, [addTask, updateTask, goToTask])

  // Add task to Google Calendar
  const handleAddToCalendar = useCallback(async (task: Task): Promise<{ success: boolean; error?: string }> => {
    if (!task.due_date) {
      return { success: false, error: 'Task has no due date' }
    }

    try {
      const response = await authFetch('/api/calendar/create-event', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          description: task.description || `Task from Gather: ${task.title}`,
          date: task.due_date,
          allDay: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to add to calendar' }
      }

      const data = await response.json()
      // Save the calendar event ID to the task
      if (data.event?.id) {
        await updateTask(task.id, { calendar_event_id: data.event.id } as Partial<Task>)
      }

      return { success: true }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [updateTask])

  // Remove task from Google Calendar
  const handleRemoveFromCalendar = useCallback(async (task: Task): Promise<{ success: boolean; error?: string }> => {
    if (!task.calendar_event_id) {
      return { success: false, error: 'Task has no calendar event' }
    }

    try {
      const response = await authFetch(`/api/calendar/create-event?googleEventId=${task.calendar_event_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Failed to remove from calendar' }
      }

      // Clear the calendar event ID from the task
      await updateTask(task.id, { calendar_event_id: null } as Partial<Task>)

      return { success: true }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [updateTask])

  // Toggle habit completion for today
  const handleToggleHabit = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const wasCompleted = isHabitCompletedToday(task)
    const currentStreak = task.streak?.current || 0
    const bestStreak = task.streak?.best || 0
    const lastCompleted = task.streak?.lastCompleted
    const completions = task.streak?.completions || []
    const todayStr = new Date().toISOString().split('T')[0]

    if (wasCompleted) {
      // Uncompleting - remove today from completions
      await updateTask(taskId, {
        streak: {
          current: Math.max(0, currentStreak - 1),
          best: bestStreak,
          lastCompleted: undefined,
          completions: completions.filter(d => d !== todayStr),
        },
      } as Partial<Task>)
    } else {
      // Completing - calculate new streak and add to completions
      const result = calculateNewStreak(currentStreak, lastCompleted)
      const newCurrent = result.shouldIncrement ? result.current : currentStreak

      await updateTask(taskId, {
        streak: {
          current: newCurrent,
          best: Math.max(bestStreak, newCurrent),
          lastCompleted: new Date().toISOString(),
          completions: completions.includes(todayStr) ? completions : [todayStr, ...completions],
        },
      } as Partial<Task>)
    }
  }, [tasks, updateTask])

  // Clear all completed tasks
  const handleClearCompleted = useCallback(async () => {
    // Find all tasks where all steps are done
    const completedTasks = tasks.filter(task => {
      const steps = task.steps || []
      if (steps.length === 0) return false
      return steps.every(s => s.done)
    })

    // Delete each completed task
    for (const task of completedTasks) {
      await deleteTask(task.id)
    }
  }, [tasks, deleteTask])

  // Toggle task pinned state
  const handleTogglePin = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    await updateTask(taskId, { pinned: !task.pinned } as Partial<Task>)
  }, [tasks, updateTask])

  // Handle AI card action with focus step support
  const handleAICardAction = useCallback(async (action: { type: string; stepId?: string | number; title?: string; context?: string }) => {
    if (action.type === 'focus_step' && action.stepId !== undefined) {
      setFocusStepId(action.stepId)
      return
    }
    await baseHandleAICardAction(action)
  }, [baseHandleAICardAction, setFocusStepId])

  // Handle stuck on step - show prompt in AI card
  const handleStuckOnStep = useCallback((step: Step) => {
    setStepContext(step)
    setAiCard({
      message: `What's blocking you on "${step.text.length > 50 ? step.text.slice(0, 50) + '...' : step.text}"?`,
      autoFocusInput: true,
    })
  }, [setStepContext, setAiCard])

  // Handle starting focus mode from FocusLauncher
  const handleStartFocus = useCallback((task: Task, stepIndex: number) => {
    setShowFocusLauncher(false)
    setCurrentTaskId(task.id)
    // Set focus to the specific step
    const step = task.steps?.[stepIndex]
    if (step) {
      setFocusStepId(step.id)
    }
  }, [setCurrentTaskId, setFocusStepId])

  // Handle snoozing a task from FocusLauncher
  const handleFocusLauncherSnooze = useCallback((taskId: string, duration: 'later' | 'tomorrow' | 'skip') => {
    if (duration === 'later') {
      // Snooze to later today (4 hours from now)
      const laterDate = new Date()
      laterDate.setHours(laterDate.getHours() + 4)
      handleSnoozeTask(taskId, laterDate.toISOString())
    } else if (duration === 'tomorrow') {
      // Snooze to tomorrow morning
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      handleSnoozeTask(taskId, tomorrow.toISOString())
    }
    // 'skip' just closes the launcher without doing anything
    setShowFocusLauncher(false)
  }, [handleSnoozeTask])

  // Handle task selection from HelpMePick
  const handleHelpMePickSelect = useCallback((task: Task) => {
    setShowHelpMePick(false)
    setCurrentTaskId(task.id)
  }, [setCurrentTaskId])

  // Handle tasks from brain dump
  const handleBrainDumpTasks = useCallback(async (dumpTasks: Array<{ title: string; firstStep?: string }>) => {
    for (const dumpTask of dumpTasks) {
      const newTask = await addTask(
        dumpTask.title,
        'soon',
        undefined, // description
        undefined, // badge
        undefined, // clarifyingAnswers
        undefined, // taskCategory
        null,      // dueDate
        'task',    // taskType
        null       // scheduledAt
      )

      // If there's a first step, add it
      if (newTask && dumpTask.firstStep) {
        const step = {
          id: `step-${Date.now()}`,
          text: dumpTask.firstStep,
          done: false,
        }
        await updateTask(newTask.id, { steps: [step] } as Partial<Task>)
      }
    }
  }, [addTask, updateTask])

  if (loading) {
    return <GatherAppSkeleton />
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header - only show on home view */}
      {!currentTaskId && (
        <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
          <div className="px-5 py-4">
            <div className="max-w-[540px] mx-auto">
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-display font-semibold tracking-tight text-text">Gather</h1>
                <div className="flex items-center gap-1">
                  {/* View toggle - list/day/stack */}
                  <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
                  <button
                    onClick={() => setShowIntegrationSettings(true)}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
                    title="Integrations"
                  >
                    <svg className="w-[20px] h-[20px] md:w-[24px] md:h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mood Picker - only show on home view, once per session */}
      {!currentTaskId && showMoodPicker && (
        <MoodPicker onSelect={handleMoodSelect} onDismiss={handleMoodDismiss} />
      )}

      {/* Views */}
      {!currentTaskId ? (
        <>
          {viewMode === 'stack' ? (
            <ErrorBoundary>
              <StackView
                tasks={tasks}
                onToggleStep={handleToggleStep}
                onGoToTask={goToTask}
                onAddTask={handleSubmit}
                onAddEmailAsTask={(email) => handleSubmit(email.subject)}
                aiCard={aiCard}
                pendingInput={pendingInput}
                onDismissAI={dismissAI}
                onQuickReply={handleQuickReply}
                onAICardAction={handleAICardAction}
                onSwitchView={() => setViewMode('list')}
                onSignOut={onSignOut}
                isDemoUser={isDemoUser}
              />
            </ErrorBoundary>
          ) : viewMode === 'day' ? (
            <ErrorBoundary>
              <DayView
                tasks={tasks}
                aiCard={aiCard}
                pendingInput={pendingInput}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onSubmit={handleSubmit}
                onQuickAdd={handleQuickAdd}
                onQuickReply={handleQuickReply}
                onDismissAI={dismissAI}
                onGoToTask={goToTask}
                onToggleStep={handleToggleStep}
                onToggleHabit={handleToggleHabit}
                onAICardAction={handleAICardAction}
                onSignOut={onSignOut}
                isDemoUser={isDemoUser}
              />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary>
              <HomeView
                tasks={tasks}
                moodEntries={moodEntries}
                aiCard={aiCard}
                pendingInput={pendingInput}
                onSubmit={handleSubmit}
                onQuickAdd={handleQuickAdd}
                onQuickReply={handleQuickReply}
                onDismissAI={dismissAI}
                onGoToTask={goToTask}
                onToggleStep={handleToggleStep}
                onToggleHabit={handleToggleHabit}
                onSuggestionClick={handleSuggestionClick}
                onDeleteTask={handleDeleteTask}
                onClearCompleted={handleClearCompleted}
                onTogglePin={handleTogglePin}
                onSnoozeTask={handleSnoozeTask}
                onAICardAction={handleAICardAction}
                onBackQuestion={handleBackQuestion}
                canGoBack={Boolean(contextGathering && contextGathering.currentIndex > 0)}
                isDemoUser={isDemoUser}
                onOpenTemplates={() => setShowTemplateModal(true)}
                onOpenBrainDump={() => setShowBrainDump(true)}
              />
            </ErrorBoundary>
          )}
          {/* Footer - only show for list view */}
          {viewMode === 'list' && (
            <div className="px-5 pb-8">
              <div className="max-w-[540px] mx-auto text-center">
                <button
                  onClick={onSignOut}
                  className="text-xs text-text-muted hover:text-text-soft"
                >
                  {isDemoUser ? 'Exit demo' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : currentTask ? (
        <ErrorBoundary>
          <TaskView
            task={currentTask}
            tasks={tasks}
            aiCard={aiCard}
            contextTags={contextTags}
            onBack={goHome}
            onSubmit={handleSubmit}
            onDismissAI={dismissAI}
            onQuickReply={handleQuickReply}
            onAICardAction={handleAICardAction}
            onToggleStep={(stepId) => handleToggleStep(currentTask.id, stepId)}
            onEditStep={(stepId, newText) => handleEditStep(currentTask.id, stepId, newText)}
            onDeleteStep={(stepId) => handleDeleteStep(currentTask.id, stepId)}
            onAddStep={(text) => handleAddStep(currentTask.id, text)}
            onMoveStep={(stepId, direction) => handleMoveStep(currentTask.id, stepId, direction)}
            onSetStepContext={setStepContext}
            onRemoveTag={removeTag}
            onDeleteTask={() => handleDeleteTask(currentTask.id)}
            onSnoozeTask={(date) => handleSnoozeTask(currentTask.id, date)}
            onScheduleTask={(datetime) => handleScheduleTask(currentTask.id, datetime)}
            onSetRecurrence={(recurrence) => handleSetRecurrence(currentTask.id, recurrence)}
            onSetEnergy={(energy) => handleSetEnergy(currentTask.id, energy)}
            onAddToCalendar={!isDemoUser ? () => handleAddToCalendar(currentTask) : undefined}
            onRemoveFromCalendar={!isDemoUser ? () => handleRemoveFromCalendar(currentTask) : undefined}
            onDuplicateTask={() => handleDuplicateTask(currentTask)}
            focusStepId={focusStepId}
            onStuckOnStep={handleStuckOnStep}
            onClearLeftOffNote={() => handleClearLeftOffNote(currentTask.id)}
          />
        </ErrorBoundary>
      ) : null}

      {/* Celebration */}
      <Confetti active={showConfetti} onComplete={dismissConfetti} />
      <CompletionCelebration
        taskName={completedTaskName}
        onDismiss={dismissCelebration}
      />

      {/* Undo Toast */}
      <UndoToast
        action={pendingUndo}
        onUndo={executeUndo}
        onDismiss={dismissUndo}
      />

      {/* Integration Settings Modal */}
      <IntegrationSettings
        isOpen={showIntegrationSettings}
        onClose={() => setShowIntegrationSettings(false)}
      />

      {/* Chat Modal */}
      <ChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        onGoToTask={goToTask}
        addTask={addTask}
        updateTask={updateTask}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
      )}

      {/* Task Template Modal */}
      {showTemplateModal && (
        <TaskTemplateModal
          onSelect={handleSelectTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {/* Focus Launcher */}
      {showFocusLauncher && (
        <FocusLauncher
          tasks={tasks}
          onStartFocus={handleStartFocus}
          onSnooze={handleFocusLauncherSnooze}
          onExit={() => setShowFocusLauncher(false)}
        />
      )}

      {/* Help Me Pick */}
      {showHelpMePick && (
        <HelpMePick
          tasks={tasks}
          onSelectTask={handleHelpMePickSelect}
          onCancel={() => setShowHelpMePick(false)}
        />
      )}

      {/* Brain Dump Modal */}
      <BrainDumpModal
        isOpen={showBrainDump}
        onClose={() => setShowBrainDump(false)}
        onAddTasks={handleBrainDumpTasks}
      />

      {/* Context Capture Modal - "Where I left off" notes */}
      {contextCaptureTask && (
        <ContextCaptureModal
          isOpen={showContextCapture}
          taskTitle={contextCaptureTask.title}
          onSave={handleSaveContextNote}
          onSkip={handleSkipContextNote}
        />
      )}

      {/* Chat FAB - floating action button */}
      <button
        onClick={() => setShowChatModal(true)}
        className="
          fixed z-40
          w-14 h-14
          flex items-center justify-center
          bg-accent text-white
          rounded-full
          shadow-lg hover:shadow-xl
          hover:bg-accent/90
          active:scale-95
          transition-all duration-150
          bottom-6 right-6
        "
        aria-label="Open chat"
        title="Chat with AI"
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <path
            d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
