'use client'

import { useMemo } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { splitStepText } from '@/lib/stepText'
import { getNextStep } from '@/hooks/useTaskSearch'
import { UnifiedInput } from './UnifiedInput'
import { AICard, AICardState } from './AICard'
import { TaskListItem } from './TaskListItem'
import { Checkbox } from './Checkbox'
import { EmailTasksCard } from './EmailTasksCard'
import { ReflectionCard } from './ReflectionCard'
import { StatsCard } from './StatsCard'
import { getDeadlineUrgency } from './DeadlineBadge'
import { content } from '@/config/content'
import { User } from '@supabase/supabase-js'

interface HomeViewProps {
  tasks: Task[]
  aiCard: AICardState | null
  pendingInput: string | null
  user: User | null
  onSubmit: (value: string) => void
  onQuickAdd: (value: string) => void
  onQuickReply: (reply: string) => void
  onDismissAI: () => void
  onGoToTask: (taskId: string) => void
  onToggleStep: (taskId: string, stepId: string | number) => void
  onSuggestionClick: (suggestion: string) => void
  onDeleteTask?: (taskId: string) => void
  onAICardAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
  onBackQuestion?: () => void
  canGoBack?: boolean
  onAddEmailTask?: (title: string, context: string) => void
}

export function HomeView({
  tasks,
  aiCard,
  pendingInput,
  user,
  onSubmit,
  onQuickAdd,
  onQuickReply,
  onDismissAI,
  onGoToTask,
  onToggleStep,
  onSuggestionClick,
  onDeleteTask,
  onAICardAction,
  onBackQuestion,
  canGoBack = false,
  onAddEmailTask,
}: HomeViewProps) {
  // Filter out snoozed tasks (hidden until their snooze date)
  const activeTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return tasks.filter(task => {
      if (!task.snoozed_until) return true
      return task.snoozed_until <= today // Show if snooze date has passed
    })
  }, [tasks])

  // Sort tasks by deadline urgency (overdue/today first, then by due date, then no deadline last)
  const sortedTasks = useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      const urgencyA = getDeadlineUrgency(a.due_date)
      const urgencyB = getDeadlineUrgency(b.due_date)
      return urgencyA - urgencyB
    })
  }, [activeTasks])

  // Count snoozed tasks
  const snoozedCount = tasks.length - activeTasks.length

  const nextStep = getNextStep(activeTasks)
  const awaitingFreeText = Boolean(aiCard?.question && (!aiCard.quickReplies || aiCard.quickReplies.length === 0))
  const isQuestionFlow = Boolean(aiCard?.question)
  const inputPlaceholder = isQuestionFlow
    ? content.placeholders.aiFreeText
    : content.placeholders.homeInput
  const totalSteps = activeTasks.reduce((sum, task) => sum + (task.steps?.length || 0), 0)
  const incompleteSteps = activeTasks.reduce(
    (sum, task) => sum + (task.steps?.filter((step) => !step.done).length || 0),
    0
  )
  const getDerivedStepTitle = (text: string) => splitStepText(text).title

  // Find quick wins - tasks with only 1-2 steps remaining
  const quickWins = useMemo(() => {
    return activeTasks.filter(task => {
      if (!task.steps || task.steps.length === 0) return false
      const remainingSteps = task.steps.filter(s => !s.done)
      if (remainingSteps.length === 0) return false // All done
      if (remainingSteps.length > 2) return false // Too many steps
      // If nextStep is from this task, exclude it (already shown)
      if (nextStep?.task.id === task.id) return false
      return true
    }).slice(0, 3) // Show max 3 quick wins
  }, [activeTasks, nextStep])

  return (
    <div className="min-h-screen px-5 py-8">
      <div className="max-w-[540px] mx-auto">
        {/* Suggestions - show when no AI card */}
        {!aiCard && (
          <div className="flex flex-wrap gap-2 mb-8">
            {content.homeSuggestions.map((s, index) => (
              <button
                key={s}
                onClick={() => onSuggestionClick(s)}
                className="px-4 py-2 bg-transparent border border-border rounded-full text-sm text-text-soft hover:border-accent hover:text-accent transition-all btn-press tap-target animate-rise"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Weekly Reflection - show when no AI card */}
        {!aiCard && user && (
          <div className="mb-6">
            <ReflectionCard user={user} />
          </div>
        )}

        {/* Stats Card - show when there are tasks and no AI card */}
        {!aiCard && activeTasks.length > 0 && (
          <StatsCard tasks={activeTasks} />
        )}

        {/* Email Tasks - show when no AI card and handler provided */}
        {!aiCard && onAddEmailTask && (
          <EmailTasksCard onAddTask={onAddEmailTask} />
        )}

        {/* AI Card */}
        {aiCard && (
          <AICard
            card={aiCard}
            pendingInput={pendingInput}
            onDismiss={onDismissAI}
            onQuickReply={onQuickReply}
            onGoToTask={onGoToTask}
            onAction={onAICardAction}
            onBackQuestion={onBackQuestion}
            attachInput={isQuestionFlow}
            canGoBack={canGoBack}
          />
        )}

        {/* Input */}
        <UnifiedInput
          tasks={tasks}
          onSubmit={onSubmit}
          onQuickAdd={onQuickAdd}
          placeholder={inputPlaceholder}
          animatedPlaceholders={isQuestionFlow ? [] : content.animatedPlaceholders}
          autoFocus={awaitingFreeText}
          allowDropdown={!isQuestionFlow}
          containerClassName={isQuestionFlow ? 'mb-6 -mt-2' : ''}
          inputWrapperClassName={isQuestionFlow ? 'rounded-t-none border-t-0' : ''}
          onSelectResult={(result) => {
            if (result.type === 'task') {
              onGoToTask(result.task.id)
            } else if (result.step) {
              onGoToTask(result.task.id)
            }
          }}
        />

        {/* Next Step highlight */}
        {nextStep && (
          <div className="mb-6">
            <div className="text-xs font-medium text-accent mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-50"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Next step
            </div>

            <div
              onClick={() => onGoToTask(nextStep.task.id)}
              className="next-step-card bg-card rounded-lg cursor-pointer overflow-hidden transition-all border-l-[3px] border-l-accent animate-rise"
            >
              <div className="p-4 flex gap-4">
                {/* Checkbox - using a visual checkbox with hover effect */}
                <div className="flex-shrink-0" aria-label="Mark as done">
                  <Checkbox
                    checked={nextStep.step.done}
                    onToggle={() => onToggleStep(nextStep.task.id, nextStep.step.id)}
                    size={20}
                  />
                </div>
                <div>
                  <div className="text-base font-medium mb-1">{getDerivedStepTitle(nextStep.step.text)}</div>
                  {nextStep.step.summary && (
                    <div className="text-sm text-text-soft">{nextStep.step.summary}</div>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 bg-subtle flex justify-between items-center">
                <div className="min-w-0">
                  <span className="text-sm text-text-soft truncate block">
                    {nextStep.task.title}
                  </span>
                </div>
                <span className="text-sm text-text-muted">
                  {nextStep.task.steps?.filter((s) => s.done).length || 0}/
                  {nextStep.task.steps?.length || 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Wins section */}
        {quickWins.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-medium text-success mb-3 flex items-center gap-2">
              <svg width={12} height={12} viewBox="0 0 16 16" className="opacity-80">
                <path d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6L8 1Z" fill="currentColor" />
              </svg>
              Quick wins
            </div>
            <div className="flex flex-col gap-2">
              {quickWins.map((task, index) => {
                const remaining = task.steps?.filter(s => !s.done).length || 0
                return (
                  <div
                    key={task.id}
                    onClick={() => onGoToTask(task.id)}
                    className="bg-card rounded-lg p-3 cursor-pointer hover:bg-card/80 transition-all animate-rise border-l-2 border-l-success/40"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text truncate flex-1 mr-2">{task.title}</span>
                      <span className="text-xs text-success whitespace-nowrap">
                        {remaining === 1 ? '1 step left' : `${remaining} steps left`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All done state */}
        {!nextStep && tasks.length > 0 && totalSteps > 0 && incompleteSteps === 0 && (
          <div className="mb-6 p-6 bg-success-soft rounded-lg text-center">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
              <svg width={24} height={24} viewBox="0 0 24 24" className="text-success">
                <path
                  d="M5 12l5 5L20 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <div className="text-base font-medium text-text mb-1">{content.emptyStates.homeAllCaughtUpTitle}</div>
            <div className="text-sm text-text-soft">{content.emptyStates.homeAllCaughtUpBody}</div>
          </div>
        )}

        {!nextStep && tasks.length > 0 && totalSteps === 0 && (
          <div className="mb-6 p-6 bg-subtle rounded-lg text-center">
            <div className="text-base font-medium text-text mb-1">{content.emptyStates.homeNoStepsTitle}</div>
            <div className="text-sm text-text-soft">{content.emptyStates.homeNoStepsBody}</div>
          </div>
        )}

        {/* All Tasks - sorted by deadline urgency */}
        {sortedTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-text-muted">
                All tasks
              </div>
              {snoozedCount > 0 && (
                <div className="text-xs text-text-muted flex items-center gap-1.5">
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" strokeLinecap="round" />
                  </svg>
                  {snoozedCount} snoozed
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {sortedTasks.map((task, index) => (
                <div key={task.id} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                  <TaskListItem
                    task={task}
                    onClick={() => onGoToTask(task.id)}
                    onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {tasks.length === 0 && !aiCard && (
          <div className="text-center py-12">
            <div className="text-text-soft mb-2">{content.emptyStates.homeNoTasksTitle}</div>
            <div className="text-sm text-text-muted">{content.emptyStates.homeNoTasksBody}</div>
          </div>
        )}
      </div>
    </div>
  )
}
