'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { User } from '@supabase/supabase-js'
import { useTasks, Task, Step } from '@/hooks/useUserData'
import { useMemory } from '@/hooks/useMemory'
import { useViewState } from '@/hooks/useViewState'
import { useTaskNavigation } from '@/hooks/useTaskNavigation'
import { useCelebration } from '@/hooks/useCelebration'
import { useAIConversation } from '@/hooks/useAIConversation'
import { ThemeToggle } from './ThemeProvider'
import { HomeView } from './HomeView'
import { StackView } from './StackView'
import { TaskView } from './TaskView'
import { ErrorBoundary } from './ErrorBoundary'

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

interface GatherAppProps {
  user: User
  onSignOut: () => void
}

export function GatherApp({ user, onSignOut }: GatherAppProps) {
  // Data hooks
  const { tasks, addTask, updateTask, toggleStep, deleteTask, loading } = useTasks(user)
  const { addEntry, addToConversation, getMemoryForAI, getRelevantMemory, getPreference, setPreference } = useMemory()
  const isDemoUser = Boolean(user?.id?.startsWith('demo-') || user?.email?.endsWith('@gather.local'))

  // View state
  const {
    currentTaskId,
    showIntegrationSettings,
    useStackView,
    setCurrentTaskId,
    setShowIntegrationSettings,
    setUseStackView,
  } = useViewState()

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

  // Navigate to task - combines navigation with AI state cleanup
  const goToTask = useCallback((taskId: string) => {
    navGoToTask(taskId, tasks)
    setCurrentTaskId(taskId)
    clearConversation()
  }, [navGoToTask, tasks, setCurrentTaskId, clearConversation])

  // Go back to home - combines navigation with AI state cleanup
  const goHome = useCallback(() => {
    setCurrentTaskId(null)
    navGoHome()
    clearConversation()
    clearContextTags()
  }, [setCurrentTaskId, navGoHome, clearConversation, clearContextTags])

  // Handle quick add (simple task without AI)
  const handleQuickAdd = useCallback(async (value: string) => {
    const newTask = await addTask(value, 'soon')
    if (newTask) {
      // Try to add a single step matching the task title
      try {
        await updateTask(newTask.id, {
          steps: [{ id: `step-${Date.now()}`, text: value, done: false }],
        } as Partial<Task>)
      } catch {
        // Steps column may need migration
      }
    }
  }, [addTask, updateTask])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSubmit(suggestion)
  }, [handleSubmit])

  // Handle step toggle with celebration
  const handleToggleStep = useCallback(async (taskId: string, stepId: string | number, inFocusMode = false) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) {
      await toggleStep(taskId, stepId)
      return
    }

    // Find the step being toggled
    const step = task.steps?.find((s) => s.id === stepId)
    const wasComplete = step?.done

    await toggleStep(taskId, stepId)

    // Check if this completes the task and celebrate if so
    if (wasComplete !== undefined) {
      checkAndCelebrate(task, stepId, wasComplete, addEntry)
    }
  }, [toggleStep, tasks, addEntry, checkAndCelebrate])

  // Handle step edit
  const handleEditStep = useCallback(async (taskId: string, stepId: string | number, newText: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !task.steps) return

    const updatedSteps = task.steps.map((s) =>
      s.id === stepId ? { ...s, text: newText } : s
    )

    await updateTask(taskId, { steps: updatedSteps })
  }, [tasks, updateTask])

  // Delete task
  const handleDeleteTask = useCallback(async (taskId: string) => {
    await deleteTask(taskId)
    goHome() // Navigate back home after deletion
  }, [deleteTask, goHome])

  // Snooze task
  const handleSnoozeTask = useCallback(async (taskId: string, snoozedUntil: string) => {
    await updateTask(taskId, { snoozed_until: snoozedUntil } as Partial<Task>)
    goHome() // Navigate back home after snoozing
  }, [updateTask, goHome])

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

  if (loading) {
    // Skeleton UI - matches actual layout for spatial continuity
    return (
      <div className="min-h-screen bg-canvas">
        {/* Skeleton header */}
        <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
          <div className="px-5 py-4">
            <div className="max-w-[540px] mx-auto">
              <div className="flex justify-between items-center">
                <div className="h-9 w-28 bg-surface rounded-lg animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="w-11 h-11 bg-surface rounded-lg animate-pulse" />
                  <div className="w-11 h-11 bg-surface rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton content */}
        <div className="px-5 py-6">
          <div className="max-w-[540px] mx-auto space-y-4">
            {/* Skeleton input */}
            <div className="h-14 bg-surface rounded-2xl animate-pulse" />
            {/* Skeleton task cards */}
            <div className="space-y-3 pt-2">
              <div className="h-[72px] bg-surface rounded-md animate-pulse" />
              <div className="h-[72px] bg-surface rounded-md animate-pulse opacity-75" />
              <div className="h-[72px] bg-surface rounded-md animate-pulse opacity-50" />
            </div>
          </div>
        </div>
      </div>
    )
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
                <div className="flex items-center gap-2">
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

      {/* Views */}
      {!currentTaskId ? (
        <>
          {useStackView ? (
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
                onSwitchView={() => setUseStackView(false)}
                onSignOut={onSignOut}
                isDemoUser={isDemoUser}
              />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary>
              <HomeView
                tasks={tasks}
                aiCard={aiCard}
                pendingInput={pendingInput}
                onSubmit={handleSubmit}
                onQuickAdd={handleQuickAdd}
                onQuickReply={handleQuickReply}
                onDismissAI={dismissAI}
                onGoToTask={goToTask}
                onToggleStep={handleToggleStep}
                onSuggestionClick={handleSuggestionClick}
                onDeleteTask={handleDeleteTask}
                onAICardAction={handleAICardAction}
                onBackQuestion={handleBackQuestion}
                canGoBack={Boolean(contextGathering && contextGathering.currentIndex > 0)}
                isDemoUser={isDemoUser}
              />
            </ErrorBoundary>
          )}
          {/* Footer - only show for classic view */}
          {!useStackView && (
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
          {/* View toggle - only show for Classic view (Stack view has it in header) */}
          {!useStackView && (
            <button
              onClick={() => setUseStackView(true)}
              className="
                fixed bottom-6 right-6 z-50
                px-4 py-2
                bg-card/90 backdrop-blur-sm
                border border-border-strong
                rounded-xl
                text-sm font-medium text-text
                hover:bg-card hover:border-accent/30
                active:scale-95
                shadow-md
                transition-all duration-150
              "
            >
              Stack view
            </button>
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
            onSetStepContext={setStepContext}
            onRemoveTag={removeTag}
            onDeleteTask={() => handleDeleteTask(currentTask.id)}
            onSnoozeTask={(date) => handleSnoozeTask(currentTask.id, date)}
            focusStepId={focusStepId}
            onStuckOnStep={handleStuckOnStep}
          />
        </ErrorBoundary>
      ) : null}

      {/* Celebration */}
      <Confetti active={showConfetti} onComplete={dismissConfetti} />
      <CompletionCelebration
        taskName={completedTaskName}
        onDismiss={dismissCelebration}
      />

      {/* Integration Settings Modal */}
      <IntegrationSettings
        isOpen={showIntegrationSettings}
        onClose={() => setShowIntegrationSettings(false)}
      />
    </div>
  )
}
