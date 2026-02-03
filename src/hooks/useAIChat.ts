'use client'

import { useCallback } from 'react'
import { Task } from '@/hooks/useUserData'
import { AICardState } from '@/components/AICard'
import { authFetch } from '@/lib/supabase'
import { isQuestion, detectCompletionIntent, findMatchingStep, sanitizeQuestions } from '@/lib/taskHelpers'
import type { ContextTag } from './useTaskNavigation'
import type { ContextGatheringState } from './useAIConversation'
import { useAIStreaming, StreamingContext } from './useAIStreaming'

export interface AIChatDeps {
  setAiCard: React.Dispatch<React.SetStateAction<AICardState | null>>
  setConversationHistory: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>
  setIsFollowUp: React.Dispatch<React.SetStateAction<boolean>>
  setContextGathering: React.Dispatch<React.SetStateAction<ContextGatheringState | null>>
  getPreference: (key: string) => string | undefined
  addToConversation: (role: string, content: string) => void
  getMemoryForAI: () => Array<{ role: string; content: string }>
  getRelevantMemory: (taskTitle: string) => string
  onUpgradeRequired?: () => void
}

export interface ChatContext {
  currentTaskId: string | null
  currentTask?: Task
  contextTags: ContextTag[]
  aiCard: AICardState | null
  pendingInput: string | null
  conversationHistory: Array<{ role: string; content: string }>
  isFollowUp: boolean
}

/**
 * Hook for AI chat conversation logic.
 *
 * Handles:
 * - Follow-up conversations with context
 * - Chat responses when user asks questions
 * - Building context from tags and task state
 * - Detecting completion intent and suggesting step completion
 */
export function useAIChat(deps: AIChatDeps) {
  const {
    setAiCard,
    setConversationHistory,
    setIsFollowUp,
    setContextGathering,
    getPreference,
    addToConversation,
    getMemoryForAI,
    getRelevantMemory,
    onUpgradeRequired,
  } = deps

  const { streamChatResponse } = useAIStreaming({ setAiCard, onUpgradeRequired })

  /**
   * Build structured context for AI from context tags.
   */
  const buildContextForAI = useCallback((
    contextTags: ContextTag[],
    currentTaskId: string | null,
    currentTask: Task | undefined,
    aiCard: AICardState | null,
    userMessage: string
  ): StreamingContext => {
    const taskTag = contextTags.find((tag) => tag.type === 'task')?.task
    const stepTag = contextTags.find((tag) => tag.type === 'step')?.step

    if (taskTag) {
      return {
        task: {
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
        },
        ui: {
          view: currentTaskId ? 'task' : 'home',
          has_ai_card: Boolean(aiCard),
        },
        user: { message: userMessage },
      }
    }

    return {
      task: null,
      ui: {
        view: currentTaskId ? 'task' : 'home',
        has_ai_card: Boolean(aiCard),
      },
      user: { message: userMessage },
    }
  }, [])

  /**
   * Handle a follow-up chat message in an existing conversation.
   */
  const handleFollowUpChat = useCallback(async (
    message: string,
    chatContext: ChatContext
  ): Promise<boolean> => {
    const { currentTaskId, currentTask, contextTags, aiCard, pendingInput, conversationHistory } = chatContext

    // Build context including pending task name if we're following up on task creation
    let context = buildContextForAI(contextTags, currentTaskId, currentTask, aiCard, message)

    if (aiCard?.pendingTaskName) {
      context = {
        ...context,
        user: {
          message,
          pendingTaskName: aiCard.pendingTaskName,
        },
      }
    }

    // Build history including the current exchange
    const history = [
      ...conversationHistory,
      ...(pendingInput ? [{ role: 'user', content: pendingInput }] : []),
      ...(aiCard?.message ? [{ role: 'assistant', content: aiCard.message }] : []),
    ]

    // Check if user message suggests they completed something
    let completionPrompt: string | undefined
    if (detectCompletionIntent(message) && currentTask?.steps?.length) {
      const match = findMatchingStep(message, currentTask.steps)
      if (match) {
        completionPrompt = `Mark "${match.text.length > 40 ? match.text.slice(0, 40) + '...' : match.text}" complete`
      }
    }

    const result = await streamChatResponse({
      message,
      context,
      history,
      currentTask: contextTags.find((tag) => tag.type === 'task')?.task || currentTask,
      pendingTaskName: aiCard?.pendingTaskName,
      quickReplies: completionPrompt ? [completionPrompt] : aiCard?.quickReplies,
    })

    if (result.success) {
      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        ...(pendingInput ? [{ role: 'user', content: pendingInput }] : []),
        ...(aiCard?.message ? [{ role: 'assistant', content: aiCard.message }] : []),
      ])
      setIsFollowUp(true)
    }

    return result.success
  }, [buildContextForAI, streamChatResponse, setConversationHistory, setIsFollowUp])

  /**
   * Handle a question from the home view (not in task context).
   */
  const handleHomeQuestion = useCallback(async (
    message: string,
    chatContext: ChatContext
  ): Promise<boolean> => {
    const { contextTags, currentTaskId, currentTask, aiCard, pendingInput, conversationHistory, isFollowUp } = chatContext

    const context = buildContextForAI(contextTags, currentTaskId, currentTask, aiCard, message)

    // Build history if this is a follow-up
    const history = isFollowUp
      ? [
          ...conversationHistory,
          ...(pendingInput ? [{ role: 'user', content: pendingInput }] : []),
          ...(aiCard?.message ? [{ role: 'assistant', content: aiCard.message }] : []),
        ]
      : []

    const result = await streamChatResponse({
      message,
      context,
      history,
      currentTask: contextTags.find((tag) => tag.type === 'task')?.task || currentTask,
      pendingTaskName: aiCard?.pendingTaskName,
      quickReplies: aiCard?.quickReplies,
    })

    if (result.success) {
      setConversationHistory(prev => [
        ...prev,
        ...(isFollowUp && pendingInput ? [{ role: 'user', content: pendingInput }] : []),
        ...(isFollowUp && aiCard?.message ? [{ role: 'assistant', content: aiCard.message }] : []),
      ])
      setIsFollowUp(true)
    }

    return result.success
  }, [buildContextForAI, streamChatResponse, setConversationHistory, setIsFollowUp])

  /**
   * Analyze user intent and start context gathering if needed.
   * Returns intent data for task creation or starts Q&A flow.
   */
  const analyzeIntentAndGather = useCallback(async (
    message: string
  ): Promise<{
    needsQuestions: boolean
    questions?: Array<{ key: string; question?: string; text?: string; options: string[] }>
    taskName?: string
    intentData?: {
      ifComplete?: {
        steps?: Array<{ text: string; summary?: string; detail?: string; time?: string }>
        contextSummary?: string
      }
      deadline?: { date?: string }
      extractedContext?: Record<string, unknown>
      needsMoreInfo?: boolean
    }
  } | null> => {
    setAiCard({ thinking: true, message: "Understanding what you need..." })

    // Get relevant memory for this type of task
    const relevantMemory = getRelevantMemory(message)
    const memoryContext = getMemoryForAI()

    try {
      const response = await authFetch('/api/analyze-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          memory: [
            ...memoryContext,
            ...(relevantMemory ? [{ role: 'system', content: relevantMemory }] : []),
          ],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze intent')
      }

      const data = await response.json()

      // Add to conversation history
      addToConversation('user', message)
      addToConversation('assistant', data.understanding || 'Asked clarifying questions')

      // Determine if we should ask questions
      const shouldAskQuestions = data.needsMoreInfo !== false || !data.ifComplete?.steps || data.ifComplete.steps.length < 2

      if (shouldAskQuestions && data.questions?.length > 0) {
        const sanitizedQuestions = sanitizeQuestions(data.taskName || message, data.questions)
        const firstQuestionText = sanitizedQuestions[0].question || sanitizedQuestions[0].text || ''
        const firstQuestionKey = sanitizedQuestions[0].key
        const savedAnswer = firstQuestionKey ? getPreference(firstQuestionKey) : undefined

        // Start context gathering
        setContextGathering({
          questions: sanitizedQuestions,
          currentIndex: 0,
          answers: {},
          taskName: data.taskName || message,
        })

        setAiCard({
          introMessage: undefined,
          question: {
            text: firstQuestionText,
            index: 1,
            total: sanitizedQuestions.length,
          },
          quickReplies: sanitizedQuestions[0].options,
          pendingTaskName: data.taskName || message,
          savedAnswer,
        })

        return {
          needsQuestions: true,
          questions: sanitizedQuestions,
          taskName: data.taskName || message,
        }
      }

      // AI has enough info or returned steps
      return {
        needsQuestions: false,
        taskName: data.taskName || message,
        intentData: {
          ifComplete: data.ifComplete,
          deadline: data.deadline,
          extractedContext: data.extractedContext,
          needsMoreInfo: data.needsMoreInfo,
        },
      }
    } catch {
      // AI failed - show friendly error
      setAiCard({
        message: "I couldn't analyze that right now. You can try again or I'll add it with basic steps.",
        quickReplies: ['Try again', 'Add with basic steps'],
        pendingTaskName: message,
      })
      return null
    }
  }, [setAiCard, getRelevantMemory, getMemoryForAI, addToConversation, getPreference, setContextGathering])

  /**
   * Check if a message is a question (re-export from taskHelpers).
   */
  const isQuestionMessage = useCallback((message: string): boolean => {
    return isQuestion(message)
  }, [])

  return {
    buildContextForAI,
    handleFollowUpChat,
    handleHomeQuestion,
    analyzeIntentAndGather,
    isQuestionMessage,
  }
}
