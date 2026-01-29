'use client'

import { useState, useCallback } from 'react'
import { Task, Step } from '@/hooks/useUserData'

/**
 * AI Card state types
 */
export interface AICardState {
  thinking?: boolean
  streaming?: boolean // True when streaming tokens (shows partial message with cursor)
  streamingText?: string // Partial text being streamed
  message?: string
  introMessage?: string
  question?: {
    text: string
    index: number
    total: number
  }
  sources?: { title: string; url: string }[]
  quickReplies?: string[]
  actions?: Array<{
    type: 'mark_step_done' | 'focus_step' | 'create_task' | 'show_sources'
    stepId?: string | number
    title?: string
    context?: string
    label?: string
  }>
  showSources?: boolean
  pendingTaskName?: string
  taskCreated?: Task
  taskId?: string
}

export interface UseAICardOptions {
  onDismiss?: () => void
}

/**
 * Hook for managing AI card state
 *
 * Handles the display of AI responses, questions, and task creation confirmations.
 */
export function useAICard(options: UseAICardOptions = {}) {
  const [card, setCard] = useState<AICardState | null>(null)
  const [pendingInput, setPendingInput] = useState<string | null>(null)

  /**
   * Show thinking state (loading skeleton)
   */
  const showThinking = useCallback((preserveMessage?: string) => {
    setCard({
      thinking: true,
      message: preserveMessage,
    })
  }, [])

  /**
   * Start streaming state - shows typing indicator initially
   */
  const startStreaming = useCallback(() => {
    setCard({
      streaming: true,
      streamingText: '',
    })
  }, [])

  /**
   * Append token to streaming text
   */
  const appendStreamingToken = useCallback((token: string) => {
    setCard(prev => prev ? {
      ...prev,
      streaming: true,
      streamingText: (prev.streamingText || '') + token,
    } : {
      streaming: true,
      streamingText: token,
    })
  }, [])

  /**
   * Complete streaming - transition to final message state
   */
  const completeStreaming = useCallback((
    finalMessage?: string,
    opts?: {
      sources?: { title: string; url: string }[]
      actions?: AICardState['actions']
      quickReplies?: string[]
      showSources?: boolean
      pendingTaskName?: string
    }
  ) => {
    setCard(prev => ({
      streaming: false,
      streamingText: undefined,
      message: finalMessage || prev?.streamingText || '',
      sources: opts?.sources,
      actions: opts?.actions,
      quickReplies: opts?.quickReplies,
      showSources: opts?.showSources ?? true,
      pendingTaskName: opts?.pendingTaskName,
    }))
  }, [])

  /**
   * Show a simple message
   */
  const showMessage = useCallback((
    message: string,
    opts?: {
      quickReplies?: string[]
      sources?: { title: string; url: string }[]
      pendingTaskName?: string
    }
  ) => {
    setCard({
      message,
      quickReplies: opts?.quickReplies,
      sources: opts?.sources,
      pendingTaskName: opts?.pendingTaskName,
    })
  }, [])

  /**
   * Show a question with options
   */
  const showQuestion = useCallback((
    text: string,
    options: string[],
    progress?: { index: number; total: number },
    pendingTaskName?: string
  ) => {
    setCard({
      question: {
        text,
        index: progress?.index ?? 1,
        total: progress?.total ?? 1,
      },
      quickReplies: options,
      pendingTaskName,
    })
  }, [])

  /**
   * Show task creation confirmation
   */
  const showTaskCreated = useCallback((
    task: Task,
    message?: string
  ) => {
    setCard({
      message: message || "Here's your plan.",
      taskCreated: task,
    })
  }, [])

  /**
   * Show AI response with actions
   */
  const showResponse = useCallback((
    message: string,
    opts?: {
      sources?: { title: string; url: string }[]
      actions?: AICardState['actions']
      quickReplies?: string[]
      showSources?: boolean
      pendingTaskName?: string
    }
  ) => {
    setCard({
      message,
      sources: opts?.sources,
      actions: opts?.actions,
      quickReplies: opts?.quickReplies,
      showSources: opts?.showSources ?? true,
      pendingTaskName: opts?.pendingTaskName,
    })
  }, [])

  /**
   * Show error with retry option
   */
  const showError = useCallback((
    message: string,
    pendingTaskName?: string
  ) => {
    setCard({
      message,
      quickReplies: ['Try again', 'Add task without steps'],
      pendingTaskName,
    })
  }, [])

  /**
   * Update current card state
   */
  const update = useCallback((updates: Partial<AICardState>) => {
    setCard(prev => prev ? { ...prev, ...updates } : updates)
  }, [])

  /**
   * Clear the AI card
   */
  const clear = useCallback(() => {
    setCard(null)
    if (options.onDismiss) {
      options.onDismiss()
    }
  }, [options])

  /**
   * Store pending input for retry
   */
  const storePendingInput = useCallback((input: string) => {
    setPendingInput(input)
  }, [])

  /**
   * Clear pending input
   */
  const clearPendingInput = useCallback(() => {
    setPendingInput(null)
  }, [])

  /**
   * Check if card is showing a question
   */
  const isShowingQuestion = card !== null && card.question !== undefined

  /**
   * Check if card is in thinking state
   */
  const isThinking = card?.thinking ?? false

  /**
   * Check if card has a task created
   */
  const hasTaskCreated = card?.taskCreated !== undefined

  /**
   * Check if card is streaming
   */
  const isStreaming = card?.streaming ?? false

  return {
    // State
    card,
    pendingInput,
    isShowingQuestion,
    isThinking,
    isStreaming,
    hasTaskCreated,

    // Actions
    showThinking,
    startStreaming,
    appendStreamingToken,
    completeStreaming,
    showMessage,
    showQuestion,
    showTaskCreated,
    showResponse,
    showError,
    update,
    clear,
    setCard, // Direct access for complex updates
    storePendingInput,
    clearPendingInput,
  }
}

/**
 * Format action label based on type
 */
export function formatActionLabel(action: { type: string; label?: string }): string {
  if (action.label) return action.label

  switch (action.type) {
    case 'mark_step_done':
      return 'Mark step complete'
    case 'focus_step':
      return 'Jump to step'
    case 'create_task':
      return 'Create task'
    case 'show_sources':
      return 'Show sources'
    default:
      return action.type
  }
}

/**
 * Build a completion prompt for a step
 */
export function buildCompletionPrompt(step: Step): string {
  const text = step.text.length > 40 ? step.text.slice(0, 40) + '...' : step.text
  return `Mark "${text}" complete`
}
