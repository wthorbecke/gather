'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface ContextQuestion {
  key: string
  question?: string
  text?: string
  options: string[]
}

export interface ContextGatheringState {
  questions: ContextQuestion[]
  currentIndex: number
  answers: Record<string, string>
  taskName: string
  awaitingFreeTextFor?: { key: string; prompt: string }
}

export interface DuplicatePrompt {
  taskId: string
  taskTitle: string
  input: string
}

// Auto-clear timeout (5 minutes of inactivity)
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Hook for managing context gathering state during task creation.
 * Handles the Q&A flow when AI needs more information before creating a task.
 */
export function useContextGathering() {
  const [state, setState] = useState<ContextGatheringState | null>(null)
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track activity and set up auto-clear
  const trackActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // Auto-clear on inactivity
  useEffect(() => {
    if (!state) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    const checkInactivity = () => {
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // Debug log removed('[ContextGathering] Auto-clearing due to inactivity')
        setState(null)
      } else {
        // Check again after remaining time
        timeoutRef.current = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS - elapsed)
      }
    }

    timeoutRef.current = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [state])

  /**
   * Start a new context gathering session
   */
  const startGathering = useCallback((
    questions: ContextQuestion[],
    taskName: string
  ) => {
    trackActivity()
    setState({
      questions,
      currentIndex: 0,
      answers: {},
      taskName,
    })
  }, [trackActivity])

  /**
   * Record an answer and advance to the next question
   * Returns true if there are more questions, false if complete
   */
  const recordAnswer = useCallback((answer: string): {
    hasMore: boolean
    nextQuestion?: ContextQuestion
    allAnswers?: Record<string, string>
  } => {
    if (!state) return { hasMore: false }

    trackActivity()
    const { questions, currentIndex, answers } = state
    const currentQuestion = questions[currentIndex]

    const updatedAnswers = { ...answers, [currentQuestion.key]: answer }

    if (currentIndex < questions.length - 1) {
      // More questions to ask
      const nextIndex = currentIndex + 1
      setState({
        ...state,
        currentIndex: nextIndex,
        answers: updatedAnswers,
        awaitingFreeTextFor: undefined,
      })
      return {
        hasMore: true,
        nextQuestion: questions[nextIndex],
      }
    } else {
      // All questions answered
      return {
        hasMore: false,
        allAnswers: updatedAnswers,
      }
    }
  }, [state, trackActivity])

  /**
   * Go back to the previous question
   * Returns the previous question or null if at the start
   */
  const goBack = useCallback((): ContextQuestion | null => {
    if (!state || state.currentIndex === 0) return null

    trackActivity()
    const prevIndex = state.currentIndex - 1
    setState({
      ...state,
      currentIndex: prevIndex,
      awaitingFreeTextFor: undefined,
    })
    return state.questions[prevIndex]
  }, [state, trackActivity])

  /**
   * Set free text mode for "Other (I will specify)" answers
   */
  const setAwaitingFreeText = useCallback((key: string, prompt: string) => {
    if (!state) return

    trackActivity()
    setState({
      ...state,
      awaitingFreeTextFor: { key, prompt },
    })
  }, [state, trackActivity])

  /**
   * Update an answer without advancing (for free text mode)
   */
  const updateAnswer = useCallback((key: string, value: string) => {
    if (!state) return

    trackActivity()
    setState({
      ...state,
      answers: { ...state.answers, [key]: value },
      awaitingFreeTextFor: undefined,
    })
  }, [state, trackActivity])

  /**
   * Clear all context gathering state
   */
  const clear = useCallback(() => {
    setState(null)
    setDuplicatePrompt(null)
  }, [])

  /**
   * Get the current question
   */
  const getCurrentQuestion = useCallback((): ContextQuestion | null => {
    if (!state) return null
    return state.questions[state.currentIndex]
  }, [state])

  /**
   * Check if we can go back
   */
  const canGoBack = state !== null && state.currentIndex > 0

  /**
   * Get progress info
   */
  const getProgress = useCallback(() => {
    if (!state) return null
    return {
      current: state.currentIndex + 1,
      total: state.questions.length,
    }
  }, [state])

  /**
   * Build context description from answers (filtering out "Other" answers)
   */
  const buildContextDescription = useCallback((filterPattern?: string): string => {
    if (!state) return ''

    const pattern = filterPattern || 'other (i will specify)'
    return Object.entries(state.answers)
      .map(([, value]) => value)
      .filter((value) => value && !value.toLowerCase().includes(pattern.toLowerCase()))
      .join(' · ')
  }, [state])

  return {
    // State
    state,
    isGathering: state !== null,
    taskName: state?.taskName ?? null,
    awaitingFreeText: state?.awaitingFreeTextFor ?? null,
    canGoBack,
    duplicatePrompt,

    // Actions
    startGathering,
    recordAnswer,
    goBack,
    setAwaitingFreeText,
    updateAnswer,
    clear,
    setDuplicatePrompt,

    // Getters
    getCurrentQuestion,
    getProgress,
    buildContextDescription,
    getAnswers: () => state?.answers ?? {},
  }
}
