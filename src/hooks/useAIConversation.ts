'use client'

import { useState, useCallback, useRef } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import type { MemoryEntry } from '@/hooks/useMemory'
import { AICardState } from '@/components/AICard'
import {
  isQuestion,
  isStepRequest,
  findDuplicateTask,
  createFallbackSteps,
  mapAIStepsToSteps,
} from '@/lib/taskHelpers'
import { OTHER_SPECIFY_OPTION } from '@/config/content'
import { authFetch } from '@/lib/supabase'
import type { ContextTag } from './useTaskNavigation'
import type { ActiveTaskCategory } from '@/lib/constants'
import { useAICardState } from './useAICardState'
import { useDuplicateDetection, DuplicatePrompt } from './useDuplicateDetection'
import { useConversationHistory } from './useConversationHistory'
import { useAIStreaming } from './useAIStreaming'
import { useAITaskBreakdown } from './useAITaskBreakdown'
import { useAIChat } from './useAIChat'

// Re-export DuplicatePrompt from the extracted hook for backward compatibility
export type { DuplicatePrompt } from './useDuplicateDetection'

// Types for context gathering
export interface ContextGatheringState {
  questions: Array<{ key: string; question?: string; text?: string; options: string[] }>
  currentIndex: number
  answers: Record<string, string>
  taskName: string
  awaitingFreeTextFor?: { key: string; prompt: string }
}

export interface AIConversationState {
  aiCard: AICardState | null
  pendingInput: string | null
  conversationHistory: Array<{ role: string; content: string }>
  isFollowUp: boolean
  contextGathering: ContextGatheringState | null
  duplicatePrompt: DuplicatePrompt | null
}

export interface AIConversationDeps {
  tasks: Task[]
  currentTaskId: string | null
  contextTags: ContextTag[]
  addTask: (
    title: string,
    category: ActiveTaskCategory,
    description?: string,
    badge?: string,
    clarifyingAnswers?: Array<{ question: string; answer: string }>,
    taskCategory?: string,
    dueDate?: string | null
  ) => Promise<Task | undefined>
  updateTask: (
    taskId: string,
    updates: Partial<Task>
  ) => Promise<{ success: boolean; error?: string }>
  toggleStep: (taskId: string, stepId: string | number) => Promise<void>
  addEntry: (entry: Omit<MemoryEntry, 'id' | 'timestamp'>) => void
  addToConversation: (role: string, content: string) => void
  getMemoryForAI: () => Array<{ role: string; content: string }>
  getRelevantMemory: (taskTitle: string) => string
  getPreference: (key: string) => string | undefined
  setPreference: (key: string, value: string) => void
  goToTask: (taskId: string, tasks: Task[]) => ContextTag[]
  setCurrentTaskId: (taskId: string | null) => void
  useStackView: boolean
  onUpgradeRequired?: () => void
}

export interface AIConversationActions {
  setAiCard: React.Dispatch<React.SetStateAction<AICardState | null>>
  setPendingInput: React.Dispatch<React.SetStateAction<string | null>>
  setContextGathering: React.Dispatch<React.SetStateAction<ContextGatheringState | null>>
  setDuplicatePrompt: React.Dispatch<React.SetStateAction<DuplicatePrompt | null>>
  handleSubmit: (value: string) => Promise<void>
  handleQuickReply: (reply: string) => Promise<void>
  handleBackQuestion: () => void
  handleAICardAction: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => Promise<void>
  dismissAI: () => void
  clearConversation: () => void
}

/**
 * Hook for managing AI conversation state - AI chat state, message handling, streaming.
 *
 * This hook composes several smaller focused hooks:
 * - useAICardState: AI card UI state management
 * - useDuplicateDetection: Duplicate task detection
 * - useConversationHistory: Conversation history management
 * - useAIStreaming: Streaming chat responses
 * - useAITaskBreakdown: Task decomposition and step generation
 * - useAIChat: Core chat logic and context building
 */
export function useAIConversation(deps: AIConversationDeps): AIConversationState & AIConversationActions {
  const {
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
    goToTask,
    setCurrentTaskId,
    useStackView,
    onUpgradeRequired,
  } = deps

  // Use extracted hooks for state management
  const { aiCard, setAiCard, isFollowUp, setIsFollowUp } = useAICardState(useStackView)
  const { duplicatePrompt, setDuplicatePrompt, bypassDuplicateRef } = useDuplicateDetection()
  const { conversationHistory, setConversationHistory, clearHistory } = useConversationHistory()

  // Local state
  const [pendingInput, setPendingInput] = useState<string | null>(null)
  const [contextGathering, setContextGathering] = useState<ContextGatheringState | null>(null)

  // Performance: Use refs to avoid recreating callbacks when these values change
  const tasksRef = useRef(tasks)
  const aiCardRef = useRef(aiCard)
  const pendingInputRef = useRef(pendingInput)
  const contextTagsRef = useRef(contextTags)
  const conversationHistoryRef = useRef(conversationHistory)
  const currentTaskIdRef = useRef(currentTaskId)
  const contextGatheringRef = useRef(contextGathering)

  // Sync refs during render
  tasksRef.current = tasks
  aiCardRef.current = aiCard
  pendingInputRef.current = pendingInput
  contextTagsRef.current = contextTags
  conversationHistoryRef.current = conversationHistory
  currentTaskIdRef.current = currentTaskId
  contextGatheringRef.current = contextGathering

  const currentTask = tasks.find((t) => t.id === currentTaskId)

  // Use extracted hooks for functionality
  const { streamChatResponse } = useAIStreaming({ setAiCard, onUpgradeRequired })
  const { addStepsToTask, createTaskFromIntent, createSimpleTask, generateSteps, createTaskWithSteps } = useAITaskBreakdown({
    addTask,
    updateTask,
    addEntry,
    setAiCard,
  })
  const { analyzeIntentAndGather, isQuestionMessage } = useAIChat({
    setAiCard,
    setConversationHistory,
    setIsFollowUp,
    setContextGathering,
    getPreference,
    addToConversation,
    getMemoryForAI,
    getRelevantMemory,
    onUpgradeRequired,
  })

  // Finalize task creation after context gathering (defined before handlers that use it)
  const finalizeTaskCreation = useCallback(async (taskName: string, answers: Record<string, string>) => {
    setContextGathering(null)

    const contextDescription = Object.entries(answers)
      .filter(([, value]) => value && !value.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase()))
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')

    setAiCard({ thinking: true, message: "Got it. Researching specific steps for your situation..." })

    try {
      addToConversation('user', `Context: ${contextDescription}`)

      const response = await authFetch('/api/suggest-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskName,
          description: contextDescription,
          clarifyingAnswers: Object.entries(answers).map(([q, a]) => ({ question: q, answer: a })),
        }),
      })

      let steps: Step[] = []
      if (response.ok) {
        const data = await response.json()
        steps = mapAIStepsToSteps(data.subtasks || [])
      } else {
        steps = createFallbackSteps(taskName, contextDescription)
      }

      const contextText = Object.entries(answers)
        .map(([, value]) => value)
        .filter((value) => value && !value.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase()))
        .join(' . ')

      const createdTask = await createTaskWithSteps({
        taskName,
        contextSummary: contextText,
        steps,
        clarifyingAnswers: answers,
      })

      if (createdTask) {
        setAiCard({ message: "Here's your plan.", taskCreated: createdTask })
      }
    } catch {
      setAiCard({
        message: "I couldn't create the task. Want to try again?",
        quickReplies: ['Try again', 'Add task without steps'],
        pendingTaskName: taskName,
      })
    }
  }, [setContextGathering, setAiCard, addToConversation, createTaskWithSteps])

  // Handle context gathering replies (defined before handleQuickReply)
  const handleContextGatheringReply = useCallback(async (reply: string, taskName: string) => {
    const gathering = contextGatheringRef.current
    if (!gathering) return

    const { questions, currentIndex, answers } = gathering
    const currentQuestion = questions[currentIndex]

    // Handle free text input completion
    if (gathering.awaitingFreeTextFor) {
      const updatedAnswers = { ...answers, [gathering.awaitingFreeTextFor.key]: reply }
      const nextIndex = currentIndex + 1

      if (nextIndex < questions.length) {
        const nextQuestion = questions[nextIndex]
        setContextGathering({
          ...gathering,
          currentIndex: nextIndex,
          answers: updatedAnswers,
          awaitingFreeTextFor: undefined,
        })
        setAiCard({
          question: {
            text: nextQuestion.question || nextQuestion.text || '',
            index: nextIndex + 1,
            total: questions.length,
          },
          quickReplies: nextQuestion.options,
          pendingTaskName: taskName,
        })
        return
      }

      // All questions answered, create task
      await finalizeTaskCreation(taskName, updatedAnswers)
      return
    }

    // Handle "Other" option
    if (reply.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase())) {
      setContextGathering({
        ...gathering,
        awaitingFreeTextFor: { key: currentQuestion.key, prompt: currentQuestion.question || currentQuestion.text || '' },
      })
      setAiCard(prev => prev ? { ...prev, autoFocusInput: true, savedAnswer: reply } : prev)
      return
    }

    // Store answer and save preference
    const updatedAnswers = { ...answers, [currentQuestion.key]: reply }
    if (currentQuestion.key && reply) {
      setPreference(currentQuestion.key, reply)
    }

    // Check for more questions
    if (currentIndex < questions.length - 1) {
      const nextQuestion = questions[currentIndex + 1]
      const nextSavedAnswer = nextQuestion.key ? getPreference(nextQuestion.key) : undefined
      setContextGathering({
        ...gathering,
        currentIndex: currentIndex + 1,
        answers: updatedAnswers,
      })
      setAiCard({
        question: {
          text: nextQuestion.question || nextQuestion.text || '',
          index: currentIndex + 2,
          total: questions.length,
        },
        quickReplies: nextQuestion.options,
        pendingTaskName: taskName,
        savedAnswer: nextSavedAnswer,
      })
      return
    }

    // All questions answered, create task
    await finalizeTaskCreation(taskName, updatedAnswers)
  }, [setContextGathering, setAiCard, getPreference, setPreference, finalizeTaskCreation])

  // Core submit handler for new inputs (no circular dependency)
  const submitNewInput = useCallback(async (value: string): Promise<void> => {
    const currentAiCard = aiCardRef.current
    const currentPendingInput = pendingInputRef.current
    const currentContextTags = contextTagsRef.current
    const currentTasks = tasksRef.current
    const currentTaskIdValue = currentTaskIdRef.current
    const currentTaskValue = currentTasks.find(t => t.id === currentTaskIdValue)
    const currentConversationHistory = conversationHistoryRef.current

    const isFollowUpMessage = currentAiCard !== null && !currentAiCard.thinking && currentAiCard.message
    const isTaskView = Boolean(currentTaskIdValue && currentTaskValue)

    setPendingInput(value)

    // Duplicate detection for new tasks on home view
    if (!bypassDuplicateRef.current && !isFollowUpMessage && currentContextTags.length === 0 && !isQuestion(value)) {
      const duplicateTask = findDuplicateTask(value, currentTasks)
      if (duplicateTask) {
        setDuplicatePrompt({
          taskId: duplicateTask.id,
          taskTitle: duplicateTask.title,
          input: value,
        })
        setAiCard({
          question: {
            text: `You already have a task called "${duplicateTask.title}". Would you like to update that task instead, or create a new one?`,
            index: 1,
            total: 1,
          },
          quickReplies: ['Update existing', 'Create new anyway'],
        })
        return
      }
    }
    bypassDuplicateRef.current = false

    // Preserve the previous message when thinking (for follow-ups)
    setAiCard({
      thinking: true,
      message: isFollowUpMessage ? currentAiCard?.message : undefined
    })

    // Task view: keep context anchored to the current task
    if (isTaskView && currentTaskValue) {
      try {
        const focusedStep = currentContextTags.find(t => t.type === 'step')?.step || null
        const shouldGenerateSteps = isStepRequest(value)

        if (shouldGenerateSteps) {
          await addStepsToTask(currentTaskValue, value)
        } else {
          const context = {
            task: {
              id: currentTaskValue.id,
              title: currentTaskValue.title,
              context_text: currentTaskValue.context_text,
              steps: (currentTaskValue.steps || []).map((step) => ({
                id: step.id,
                text: step.text,
                done: step.done,
                summary: step.summary,
              })),
              focused_step: focusedStep
                ? { id: focusedStep.id, text: focusedStep.text, done: focusedStep.done, summary: focusedStep.summary }
                : null,
            },
            ui: { view: 'task', has_ai_card: Boolean(currentAiCard) },
            user: { message: value },
          }

          const history = isFollowUpMessage
            ? [
                ...currentConversationHistory,
                ...(currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
                ...(currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
              ]
            : []

          const result = await streamChatResponse({
            message: value,
            context,
            history,
            currentTask: currentTaskValue,
            pendingTaskName: currentAiCard?.pendingTaskName,
            quickReplies: currentAiCard?.quickReplies,
          })

          if (result.success) {
            setConversationHistory(prev => [
              ...prev,
              ...(isFollowUpMessage && currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
              ...(isFollowUpMessage && currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
            ])
            setIsFollowUp(true)
          }
        }
      } catch {
        setAiCard({ message: "Something went wrong. Please try again." })
      }
      return
    }

    // Home view with follow-up or question
    if (isFollowUpMessage || (currentContextTags.length > 0 && isQuestionMessage(value))) {
      try {
        const taskTag = currentContextTags.find((tag) => tag.type === 'task')?.task
        const stepTag = currentContextTags.find((tag) => tag.type === 'step')?.step

        const context = {
          task: taskTag ? {
            id: taskTag.id,
            title: taskTag.title,
            context_text: taskTag.context_text,
            steps: (taskTag.steps || []).map((step) => ({
              id: step.id,
              text: step.text,
              done: step.done,
              summary: step.summary,
            })),
            focused_step: stepTag
              ? { id: stepTag.id, text: stepTag.text, done: stepTag.done, summary: stepTag.summary }
              : null,
          } : null,
          ui: { view: currentTaskIdValue ? 'task' : 'home', has_ai_card: Boolean(currentAiCard) },
          user: { message: value, pendingTaskName: isFollowUpMessage ? currentAiCard?.pendingTaskName : undefined },
        }

        const history = isFollowUpMessage
          ? [
              ...currentConversationHistory,
              ...(currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
              ...(currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
            ]
          : []

        const result = await streamChatResponse({
          message: value,
          context,
          history,
          currentTask: taskTag || currentTaskValue,
          pendingTaskName: currentAiCard?.pendingTaskName,
          quickReplies: currentAiCard?.quickReplies,
        })

        if (result.success) {
          setConversationHistory(prev => [
            ...prev,
            ...(isFollowUpMessage && currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
            ...(isFollowUpMessage && currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
          ])
          setIsFollowUp(true)
        }
      } catch {
        setAiCard({ message: "Something went wrong. Please try again." })
      }
      return
    }

    // Add steps to existing task context
    const taskContext = currentContextTags.find(t => t.type === 'task')
    if (taskContext?.task && !isQuestionMessage(value)) {
      await addStepsToTask(taskContext.task, value)
      return
    }

    // Home view - new task creation with AI analysis
    const intentResult = await analyzeIntentAndGather(value)

    if (!intentResult) {
      return
    }

    if (intentResult.needsQuestions) {
      return
    }

    const taskName = intentResult.taskName || value
    const intentData = intentResult.intentData

    if (intentData?.ifComplete?.steps && intentData.ifComplete.steps.length > 0) {
      await createTaskFromIntent(taskName, intentData)
    } else {
      await createSimpleTask(taskName, intentData?.deadline?.date)
    }
  }, [streamChatResponse, addStepsToTask, analyzeIntentAndGather, isQuestionMessage, createTaskFromIntent, createSimpleTask, setConversationHistory, setIsFollowUp, setAiCard, setDuplicatePrompt, bypassDuplicateRef])

  // Handle AI submission (public API)
  const handleSubmit = useCallback(async (value: string): Promise<void> => {
    const currentAiCard = aiCardRef.current
    const gathering = contextGatheringRef.current

    // If in context gathering mode, delegate to context gathering handler
    if (gathering && currentAiCard?.question) {
      const taskName = currentAiCard?.pendingTaskName || pendingInputRef.current || 'New task'
      await handleContextGatheringReply(value, taskName)
      return
    }

    await submitNewInput(value)
  }, [handleContextGatheringReply, submitNewInput])

  // Handle quick reply
  const handleQuickReply = useCallback(async (reply: string): Promise<void> => {
    const currentAiCard = aiCardRef.current
    const currentPendingInput = pendingInputRef.current
    const currentTasks = tasksRef.current
    const currentTaskIdValue = currentTaskIdRef.current
    const currentTaskValue = currentTasks.find(t => t.id === currentTaskIdValue)
    const gathering = contextGatheringRef.current

    const taskName = currentAiCard?.pendingTaskName || currentPendingInput || 'New task'

    // Handle "Try again"
    if (reply === 'Try again' && currentPendingInput) {
      setAiCard(null)
      await submitNewInput(currentPendingInput)
      return
    }

    // Handle "Add with basic steps"
    if (reply === 'Add task without steps' || reply === 'Add with basic steps') {
      const steps = createFallbackSteps(taskName, '')
      const createdTask = await createTaskWithSteps({ taskName, steps })
      if (createdTask) {
        setAiCard({ message: "Here's your plan.", taskCreated: createdTask })
      } else {
        setAiCard({ message: "I couldn't add the task. Please try again." })
      }
      return
    }

    // Handle step completion quick reply
    if (reply.startsWith('Mark "') && reply.endsWith('" complete') && currentTaskValue) {
      const targetText = reply.slice(6, -10)
      const targetStep = (currentTaskValue.steps || []).find((step) => step.text === targetText)
      if (targetStep) {
        await toggleStep(currentTaskValue.id, targetStep.id)
      }
      setAiCard(null)
      return
    }

    // Handle duplicate prompt responses
    if (duplicatePrompt) {
      if (reply === 'Update existing') {
        setDuplicatePrompt(null)
        setAiCard(null)
        setPendingInput(null)
        goToTask(duplicatePrompt.taskId, currentTasks)
        setCurrentTaskId(duplicatePrompt.taskId)
        return
      }
      if (reply === 'Create new anyway') {
        const originalInput = duplicatePrompt.input
        setDuplicatePrompt(null)
        setAiCard(null)
        bypassDuplicateRef.current = true
        await submitNewInput(originalInput)
        return
      }
    }

    // Handle context gathering responses
    if (gathering) {
      await handleContextGatheringReply(reply, taskName)
      return
    }

    // Legacy flow (no context gathering) - create task with reply as description
    setAiCard({ thinking: true })

    try {
      const { steps } = await generateSteps({ taskTitle: taskName, description: reply })
      const contextText = reply === 'ASAP' ? 'High priority' : undefined
      const finalSteps = steps.length > 0 ? steps : createFallbackSteps(taskName)

      const createdTask = await createTaskWithSteps({
        taskName,
        contextSummary: contextText,
        steps: finalSteps,
      })

      if (createdTask) {
        setAiCard({ message: "Here's your plan.", taskCreated: createdTask })
      }
    } catch {
      setAiCard({ message: "I couldn't create the task. Please try again." })
    }
  }, [duplicatePrompt, toggleStep, goToTask, setCurrentTaskId, submitNewInput, createTaskWithSteps, generateSteps, setAiCard, setDuplicatePrompt, bypassDuplicateRef, handleContextGatheringReply])

  // Handle back button in context gathering
  const handleBackQuestion = useCallback(() => {
    const gathering = contextGatheringRef.current
    if (!gathering) return

    const { questions, currentIndex, answers, taskName, awaitingFreeTextFor } = gathering

    if (awaitingFreeTextFor) {
      const updatedAnswers = { ...answers }
      delete updatedAnswers[awaitingFreeTextFor.key]
      const question = questions[currentIndex]
      setContextGathering({
        ...gathering,
        answers: updatedAnswers,
        awaitingFreeTextFor: undefined,
      })
      setAiCard({
        question: {
          text: question.question || question.text || '',
          index: currentIndex + 1,
          total: questions.length,
        },
        quickReplies: question.options,
        pendingTaskName: taskName,
      })
      return
    }

    if (currentIndex === 0) return

    const prevIndex = currentIndex - 1
    const prevQuestion = questions[prevIndex]
    const updatedAnswers = { ...answers }
    const currentKey = questions[currentIndex]?.key
    if (currentKey) {
      delete updatedAnswers[currentKey]
    }

    setContextGathering({
      ...gathering,
      currentIndex: prevIndex,
      answers: updatedAnswers,
    })
    setAiCard({
      question: {
        text: prevQuestion.question || prevQuestion.text || '',
        index: prevIndex + 1,
        total: questions.length,
      },
      quickReplies: prevQuestion.options,
      pendingTaskName: taskName,
    })
  }, [setContextGathering, setAiCard])

  // Handle AI card actions
  const handleAICardAction = useCallback(async (action: { type: string; stepId?: string | number; title?: string; context?: string }) => {
    if (!action) return

    if (action.type === 'mark_step_done' && currentTask && action.stepId !== undefined) {
      const target = (currentTask.steps || []).find((step) => step.id === action.stepId)
      if (target) {
        await toggleStep(currentTask.id, target.id)
      }
      return
    }

    if (action.type === 'focus_step' && action.stepId !== undefined) {
      return
    }

    if (action.type === 'create_task' && action.title) {
      const steps = createFallbackSteps(action.title, action.context || '')
      const createdTask = await createTaskWithSteps({
        taskName: action.title,
        contextSummary: action.context,
        steps,
      })
      if (createdTask) {
        setAiCard({
          message: `Created "${action.title}".`,
          taskCreated: createdTask,
        })
      }
      return
    }

    if (action.type === 'show_sources') {
      setAiCard((prev) => (prev ? { ...prev, showSources: true } : prev))
    }
  }, [currentTask, toggleStep, createTaskWithSteps, setAiCard])

  // Dismiss AI card
  const dismissAI = useCallback(() => {
    setAiCard(null)
    setPendingInput(null)
    clearHistory()
    setIsFollowUp(false)
    setContextGathering(null)
    setDuplicatePrompt(null)
  }, [setAiCard, clearHistory, setIsFollowUp, setDuplicatePrompt])

  // Clear conversation state (for navigation)
  const clearConversation = useCallback(() => {
    setAiCard(null)
    setPendingInput(null)
    clearHistory()
    setIsFollowUp(false)
    setContextGathering(null)
  }, [setAiCard, clearHistory, setIsFollowUp])

  return {
    // State
    aiCard,
    pendingInput,
    conversationHistory,
    isFollowUp,
    contextGathering,
    duplicatePrompt,

    // Actions
    setAiCard,
    setPendingInput,
    setContextGathering,
    setDuplicatePrompt,
    handleSubmit,
    handleQuickReply,
    handleBackQuestion,
    handleAICardAction,
    dismissAI,
    clearConversation,
  }
}
