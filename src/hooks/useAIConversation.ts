'use client'

import { useState, useCallback, useRef } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import type { MemoryEntry } from '@/hooks/useMemory'
import { AICardState } from '@/components/AICard'
import {
  isQuestion,
  isStepRequest,
  filterActions,
  sanitizeQuestions,
  findDuplicateTask,
  detectCompletionIntent,
  findMatchingStep,
  createFallbackSteps,
  mapAIStepsToSteps,
} from '@/lib/taskHelpers'
import { OTHER_SPECIFY_OPTION } from '@/config/content'
import { splitStepText } from '@/lib/stepText'
import { authFetch } from '@/lib/supabase'
import { consumeStream, parseAIMessage, parseStreamingMessage } from '@/lib/ai'
import type { ChatAction, SubtaskItem, AnalyzeIntentStep } from '@/lib/api-types'
import type { ContextTag } from './useTaskNavigation'
import type { ActiveTaskCategory } from '@/lib/constants'
import { useAICardState } from './useAICardState'
import { useDuplicateDetection, DuplicatePrompt } from './useDuplicateDetection'
import { useConversationHistory } from './useConversationHistory'

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
 * Hook for managing AI conversation state - AI chat state, message handling, streaming
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

  // Local state that hasn't been extracted
  const [pendingInput, setPendingInput] = useState<string | null>(null)

  // Context gathering state - stores AI-generated questions and answers
  const [contextGathering, setContextGathering] = useState<ContextGatheringState | null>(null)

  // Performance: Use refs to avoid recreating callbacks when these values change
  const tasksRef = useRef(tasks)
  const aiCardRef = useRef(aiCard)
  const pendingInputRef = useRef(pendingInput)
  const contextTagsRef = useRef(contextTags)
  const conversationHistoryRef = useRef(conversationHistory)
  const currentTaskIdRef = useRef(currentTaskId)

  // Sync refs during render
  tasksRef.current = tasks
  aiCardRef.current = aiCard
  pendingInputRef.current = pendingInput
  contextTagsRef.current = contextTags
  conversationHistoryRef.current = conversationHistory
  currentTaskIdRef.current = currentTaskId

  const currentTask = tasks.find((t) => t.id === currentTaskId)

  // Build context string from context tags
  const buildContextFromTags = useCallback(() => {
    const parts: string[] = []

    for (const tag of contextTags) {
      if (tag.type === 'task' && tag.task) {
        const task = tag.task
        const existingSteps = (task.steps || [])
          .map((s, i) => `${i + 1}. ${s.text}${s.done ? ' (done)' : ''}`)
          .join('\n')

        parts.push(`Task: ${task.title}`)
        if (task.description) parts.push(`Description: ${task.description}`)
        if (task.context_text) parts.push(`Context: ${task.context_text}`)
        if (existingSteps) parts.push(`Steps:\n${existingSteps}`)
      } else if (tag.type === 'step' && tag.step) {
        const step = tag.step
        parts.push(`\nFocused step: "${step.text}"`)
        if (step.detail) parts.push(`Detail: ${step.detail}`)
        if (step.summary) parts.push(`Summary: ${step.summary}`)
      }
    }

    return parts.join('\n') || 'No context provided.'
  }, [contextTags])

  // Handle AI submission
  const handleSubmit = useCallback(async (value: string) => {
    // Use refs to get current values without needing them as dependencies
    const currentAiCard = aiCardRef.current
    const currentPendingInput = pendingInputRef.current
    const currentContextTags = contextTagsRef.current
    const currentTasks = tasksRef.current
    const currentTaskIdValue = currentTaskIdRef.current
    const currentTaskValue = currentTasks.find(t => t.id === currentTaskIdValue)
    const currentConversationHistory = conversationHistoryRef.current

    if (contextGathering && currentAiCard?.question) {
      await handleQuickReply(value)
      return
    }
    // Check if this is a follow-up to an existing conversation (AI card showing with a message)
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

    // Task view: keep context anchored to the current task (never create a new task)
    if (isTaskView && currentTaskValue) {
      try {
        const focusedStep = currentContextTags.find(t => t.type === 'step')?.step || null
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
              ? {
                  id: focusedStep.id,
                  text: focusedStep.text,
                  done: focusedStep.done,
                  summary: focusedStep.summary,
                }
              : null,
          },
          ui: {
            view: 'task',
            has_ai_card: Boolean(currentAiCard),
          },
          user: { message: value },
        }

        const shouldGenerateSteps = isStepRequest(value)
        if (!shouldGenerateSteps) {
          const history = isFollowUpMessage
            ? [
                ...conversationHistory,
                ...(currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
                ...(currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
              ]
            : []

          // Use streaming for chat responses
          setAiCard({ streaming: true, streamingText: '', pendingTaskName: currentAiCard?.pendingTaskName })

          const response = await authFetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            body: JSON.stringify({
              message: value,
              context,
              history,
              stream: true,
            }),
          })

          if (response.ok) {
            let streamedSources: { title: string; url: string }[] = []
            let streamedActions: ChatAction[] = []
            let fullText = ''

            // Check content type to see if server is streaming
            const contentType = response.headers.get('content-type')
            if (contentType?.includes('text/event-stream')) {
              // Stream the response
              await consumeStream(response, {
                onToken: (text) => {
                  fullText += text
                  setAiCard(prev => ({
                    ...prev,
                    streaming: true,
                    streamingText: parseStreamingMessage(fullText),
                  }))
                },
                onSources: (sources) => {
                  streamedSources = sources
                },
                onDone: (finalData) => {
                  // Parse the done event data if it's an object
                  try {
                    const parsed = typeof finalData === 'string' ? JSON.parse(finalData) : finalData
                    if (parsed.actions) streamedActions = parsed.actions
                    if (parsed.sources) streamedSources = parsed.sources
                    if (parsed.response) fullText = parsed.response
                  } catch {
                    // Use accumulated text
                  }
                },
                onError: (error) => {
                  setAiCard({ message: error || "Sorry, I couldn't get an answer." })
                },
              })
            } else {
              // Fallback to non-streaming
              const data = await response.json()
              fullText = data.response || ''
              streamedSources = data.sources || []
              streamedActions = data.actions || []
            }

            // Check if user message suggests they completed something
            let completionPrompt: string | undefined
            if (detectCompletionIntent(value) && currentTaskValue.steps?.length) {
              const match = findMatchingStep(value, currentTaskValue.steps)
              if (match) {
                completionPrompt = `Mark "${match.text.length > 40 ? match.text.slice(0, 40) + '...' : match.text}" complete`
              }
            }
            setConversationHistory(prev => [
              ...prev,
              ...(isFollowUpMessage && currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
              ...(isFollowUpMessage && currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
            ])
            setIsFollowUp(true)
            const actions = filterActions(Array.isArray(streamedActions) ? streamedActions : [], currentTask) as ChatAction[]
            setAiCard({
              streaming: false,
              streamingText: undefined,
              message: parseAIMessage(fullText),
              sources: streamedSources,
              pendingTaskName: currentAiCard?.pendingTaskName,
              quickReplies: actions.length > 0 ? undefined : (completionPrompt ? [completionPrompt] : currentAiCard?.quickReplies),
              actions: actions.map((action) => ({
                ...action,
                label: action.label || (action.type === 'mark_step_done' ? `Mark step complete` : action.type === 'focus_step' ? 'Jump to step' : action.type === 'create_task' ? `Create task` : action.type === 'show_sources' ? 'Show sources' : action.type),
              })),
              showSources: actions.some((action) => action.type === 'show_sources') ? false : true,
            })
          } else {
            // Check for upgrade required response
            if (response.status === 429) {
              try {
                const errorData = await response.json()
                if (errorData.upgradeRequired && onUpgradeRequired) {
                  setAiCard({
                    streaming: false,
                    message: errorData.message || "You've reached your daily limit. Upgrade to Pro for unlimited AI assistance.",
                  })
                  onUpgradeRequired()
                  return
                }
              } catch {
                // Continue with default error handling
              }
            }
            setAiCard({
              streaming: false,
              message: "Sorry, I couldn't get an answer. Try rephrasing your question.",
            })
          }
        } else {
          const existingStepTexts = (currentTaskValue.steps || []).map(s => s.text)
          const response = await authFetch('/api/suggest-subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: currentTaskValue.title,
              description: currentTaskValue.description,
              notes: value,
              existingSubtasks: existingStepTexts,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            const newSteps = mapAIStepsToSteps(data.subtasks || [])

            await updateTask(currentTaskValue.id, {
              steps: [...(currentTaskValue.steps || []), ...newSteps],
            } as Partial<Task>)

            setAiCard({
              message: `Added ${newSteps.length} more steps.`,
            })
          } else {
            setAiCard({
              message: "Couldn't generate steps. Try being more specific.",
            })
          }
        }
      } catch {
        setAiCard({
          message: "Something went wrong. Please try again.",
        })
      }
      return
    }

    // If we have an AI card showing (follow-up) OR context tags with a question, use chat API
    if (isFollowUpMessage || (currentContextTags.length > 0 && isQuestion(value))) {
      try {
        // Build structured context - include pending task name if we're following up on task creation
        let context: {
          task: null | {
            id: string
            title: string
            context_text: string | null | undefined
            steps: Array<{ id: string | number; text: string; done: boolean; summary: string | undefined }>
            focused_step: { id: string | number; text: string; done: boolean; summary: string | undefined } | null
          }
          ui: { view: string; has_ai_card: boolean }
          user: { message: string; pendingTaskName?: string }
        } = {
          task: null,
          ui: {
            view: currentTaskIdValue ? 'task' : 'home',
            has_ai_card: Boolean(currentAiCard),
          },
          user: { message: value },
        }
        if (currentContextTags.length > 0) {
          const taskTag = currentContextTags.find((tag) => tag.type === 'task')?.task
          const stepTag = currentContextTags.find((tag) => tag.type === 'step')?.step
          if (taskTag) {
            context = {
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
                view: currentTaskIdValue ? 'task' : 'home',
                has_ai_card: Boolean(currentAiCard),
              },
              user: { message: value },
            }
          }
        }
        if (isFollowUpMessage && currentAiCard?.pendingTaskName) {
          context = {
            ...context,
            user: {
              message: value,
              pendingTaskName: currentAiCard?.pendingTaskName,
            },
          }
        }

        // Build history including the current exchange if it's a follow-up
        const history = isFollowUpMessage
          ? [
              ...currentConversationHistory,
              ...(currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
              ...(currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
            ]
          : []

        // Use streaming for chat responses
        setAiCard({ streaming: true, streamingText: '', pendingTaskName: currentAiCard?.pendingTaskName })

        const response = await authFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
          body: JSON.stringify({
            message: value,
            context,
            history,
            stream: true,
          }),
        })

        if (response.ok) {
          let streamedSources: { title: string; url: string }[] = []
          let streamedActions: ChatAction[] = []
          let fullText = ''

          const contentType = response.headers.get('content-type')
          if (contentType?.includes('text/event-stream')) {
            await consumeStream(response, {
              onToken: (text) => {
                fullText += text
                setAiCard(prev => ({
                  ...prev,
                  streaming: true,
                  streamingText: parseStreamingMessage(fullText),
                }))
              },
              onSources: (sources) => {
                streamedSources = sources as { title: string; url: string }[]
              },
              onDone: (finalText) => {
                // Try to parse actions from the response
                try {
                  const jsonMatch = finalText.match(/\{[\s\S]*\}/)
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0])
                    if (Array.isArray(parsed.actions)) {
                      streamedActions = filterActions(parsed.actions, currentContextTags.find((tag) => tag.type === 'task')?.task || currentTaskValue) as ChatAction[]
                    }
                  }
                } catch {
                  // No actions in response
                }
              },
              onError: (error) => {
                setAiCard({
                  message: error || "Something went wrong. Please try again.",
                  streaming: false,
                })
              },
            })

            // Update conversation history
            setConversationHistory(prev => [
              ...prev,
              ...(isFollowUpMessage && currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
              ...(isFollowUpMessage && currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
            ])
            setIsFollowUp(true)

            // Finalize with streaming complete
            setAiCard({
              message: parseAIMessage(fullText),
              sources: streamedSources,
              streaming: false,
              pendingTaskName: currentAiCard?.pendingTaskName,
              quickReplies: streamedActions.length > 0 ? undefined : currentAiCard?.quickReplies,
              actions: streamedActions.map((action) => ({
                ...action,
                label: action.label || (action.type === 'mark_step_done' ? `Mark step complete` : action.type === 'focus_step' ? 'Jump to step' : action.type === 'create_task' ? `Create task` : action.type === 'show_sources' ? 'Show sources' : action.type),
              })),
              showSources: streamedActions.some((action) => action.type === 'show_sources') ? false : true,
            })
          } else {
            // Fallback to JSON response if not streaming
            const data = await response.json()
            setConversationHistory(prev => [
              ...prev,
              ...(isFollowUpMessage && currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
              ...(isFollowUpMessage && currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
            ])
            setIsFollowUp(true)
            const actions = filterActions(Array.isArray(data.actions) ? data.actions : [], currentContextTags.find((tag) => tag.type === 'task')?.task || currentTaskValue) as ChatAction[]
            setAiCard({
              message: data.response,
              sources: data.sources || [],
              streaming: false,
              pendingTaskName: currentAiCard?.pendingTaskName,
              quickReplies: actions.length > 0 ? undefined : currentAiCard?.quickReplies,
              actions: actions.map((action) => ({
                ...action,
                label: action.label || (action.type === 'mark_step_done' ? `Mark step complete` : action.type === 'focus_step' ? 'Jump to step' : action.type === 'create_task' ? `Create task` : action.type === 'show_sources' ? 'Show sources' : action.type),
              })),
              showSources: actions.some((action) => action.type === 'show_sources') ? false : true,
            })
          }
        } else {
          // Check for upgrade required response
          if (response.status === 429) {
            try {
              const errorData = await response.json()
              if (errorData.upgradeRequired && onUpgradeRequired) {
                setAiCard({
                  streaming: false,
                  message: errorData.message || "You've reached your daily limit. Upgrade to Pro for unlimited AI assistance.",
                })
                onUpgradeRequired()
                return
              }
            } catch {
              // Continue with default error handling
            }
          }
          setAiCard({
            message: "Sorry, I couldn't get an answer. Try rephrasing your question.",
            streaming: false,
          })
        }
      } catch {
        setAiCard({
          message: "Something went wrong. Please try again.",
        })
      }
      return
    }

    // If we have task context and it's NOT a question, add more steps
    const taskContext = currentContextTags.find(t => t.type === 'task')
    if (taskContext?.task && !isQuestion(value)) {
      const targetTask = taskContext.task
      try {
        // Pass existing steps to avoid duplicates
        const existingStepTexts = (targetTask.steps || []).map(s => s.text)

        const response = await authFetch('/api/suggest-subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: targetTask.title,
            description: targetTask.description,
            notes: value,
            existingSubtasks: existingStepTexts,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const newSteps = mapAIStepsToSteps(data.subtasks || [])

          await updateTask(targetTask.id, {
            steps: [...(targetTask.steps || []), ...newSteps],
          } as Partial<Task>)

          setAiCard({
            message: `Added ${newSteps.length} more steps.`,
          })
        } else {
          setAiCard({
            message: "Couldn't generate steps. Try being more specific.",
          })
        }
      } catch {
        setAiCard({
          message: "Something went wrong. Please try again.",
        })
      }
      return
    }

    // Home view - creating a new task with AI-driven context gathering
    setAiCard({ thinking: true, message: "Understanding what you need..." })

    // Get relevant memory for this type of task
    const relevantMemory = getRelevantMemory(value)
    const memoryContext = getMemoryForAI()


    try {
      // Call general-purpose AI analysis endpoint
      const response = await authFetch('/api/analyze-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: value,
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
      addToConversation('user', value)
      addToConversation('assistant', data.understanding || 'Asked clarifying questions')

      // ALWAYS ask questions if the task is vague or we need more info
      const shouldAskQuestions = data.needsMoreInfo !== false || !data.ifComplete?.steps || data.ifComplete.steps.length < 2

      if (shouldAskQuestions && data.questions?.length > 0) {
        const sanitizedQuestions = sanitizeQuestions(data.taskName || value, data.questions)
        const firstQuestionText = sanitizedQuestions[0].question || sanitizedQuestions[0].text || ''
        const firstQuestionKey = sanitizedQuestions[0].key
        // Check for saved preference
        const savedAnswer = firstQuestionKey ? getPreference(firstQuestionKey) : undefined

        // AI needs more context - start gathering
        setContextGathering({
          questions: sanitizedQuestions,
          currentIndex: 0,
          answers: {},
          taskName: data.taskName || value,
        })

        setAiCard({
          introMessage: undefined,
          question: {
            text: firstQuestionText,
            index: 1,
            total: sanitizedQuestions.length,
          },
          quickReplies: sanitizedQuestions[0].options,
          pendingTaskName: data.taskName || value,
          savedAnswer, // Pass saved preference to highlight
        })
      } else if (data.ifComplete?.steps && data.ifComplete.steps.length > 0) {
        // AI has enough info - but still do web research for better steps with sources
        const taskName = data.taskName || value
        const contextSummary = data.ifComplete.contextSummary || ''
        const detectedDeadline = data.deadline?.date || null

        setAiCard({ thinking: true, message: "Researching the best steps for you..." })

        try {
          const response = await authFetch('/api/suggest-subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: taskName,
              description: contextSummary,
              context: data.extractedContext || {},
            }),
          })

          let steps: Step[] = []
          let sources: { title: string; url: string }[] = []

          if (response.ok) {
            const result = await response.json()
            sources = result.sources || []
            steps = (result.subtasks || []).map((item: SubtaskItem | string, index: number) => {
              if (typeof item === 'string') {
                return { id: `step-${Date.now()}-${index}`, text: item, done: false }
              }
              const parsed = splitStepText(item.text || '')
              return {
                id: `step-${Date.now()}-${index}`,
                text: item.text || '',
                done: false,
                summary: item.summary || parsed.remainder,
                detail: item.detail,
                time: item.time,
                source: item.source,
                action: item.action,
              }
            })
          } else {
            steps = data.ifComplete.steps.map((s: AnalyzeIntentStep, i: number) => ({
              id: `step-${Date.now()}-${i}`,
              text: s.text,
              done: false,
              summary: s.summary,
              detail: s.detail,
              time: s.time,
            }))
          }

          const newTask = await addTask(
            taskName,
            'soon',
            undefined,
            undefined,
            undefined,
            undefined,
            detectedDeadline
          )

          if (newTask) {
            await updateTask(newTask.id, {
              steps,
              context_text: contextSummary,
              due_date: detectedDeadline,
            } as Partial<Task>)

            const updatedTask: Task = {
              ...newTask,
              steps,
              context_text: contextSummary || null,
            }

            addEntry({
              type: 'task_created',
              taskTitle: taskName,
              context: {},
            })

            setAiCard({
              message: "Here's your plan.",
              taskCreated: updatedTask,
              sources,
            })
          }
        } catch {
          // Fallback to original ifComplete steps
          const steps: Step[] = data.ifComplete.steps.map((s: AnalyzeIntentStep, i: number) => ({
            id: `step-${Date.now()}-${i}`,
            text: s.text,
            done: false,
            summary: s.summary,
            detail: s.detail,
            time: s.time,
          }))

          const newTask = await addTask(taskName, 'soon', undefined, undefined, undefined, undefined, detectedDeadline)
          if (newTask) {
            await updateTask(newTask.id, { steps, context_text: contextSummary, due_date: detectedDeadline } as Partial<Task>)
            const updatedTask: Task = { ...newTask, steps, context_text: contextSummary || null }
            addEntry({ type: 'task_created', taskTitle: taskName, context: {} })
            setAiCard({ message: "Here's your plan.", taskCreated: updatedTask })
          }
        }
      } else {
        // AI didn't generate questions or steps - create task and generate steps
        const taskName = data.taskName || value
        const detectedDeadline = data.deadline?.date || null

        setAiCard({ thinking: true, message: "Breaking this down for you..." })

        try {
          // Generate steps even for "simple" tasks
          const stepResponse = await authFetch('/api/suggest-subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: taskName,
              description: '',
            }),
          })

          let steps: Step[] = []
          if (stepResponse.ok) {
            const stepData = await stepResponse.json()
            steps = (stepData.subtasks || []).map((item: SubtaskItem | string, i: number) => {
              if (typeof item === 'string') {
                return { id: `step-${Date.now()}-${i}`, text: item, done: false }
              }
              const parsed = splitStepText(item.text || '')
              return {
                id: `step-${Date.now()}-${i}`,
                text: item.text || '',
                done: false,
                summary: item.summary || parsed.remainder,
                detail: item.detail,
                time: item.time,
                source: item.source,
                action: item.action,
              }
            })
          }

          // Fallback if no steps generated
          if (steps.length === 0) {
            steps = createFallbackSteps(taskName, '')
          }

          const newTask = await addTask(
            taskName,
            'soon',
            undefined,
            undefined,
            undefined,
            undefined,
            detectedDeadline
          )

          if (newTask) {
            await updateTask(newTask.id, {
              steps,
              due_date: detectedDeadline,
            } as Partial<Task>)

            const updatedTask: Task = { ...newTask, steps }

            addEntry({
              type: 'task_created',
              taskTitle: taskName,
              context: {},
            })

            setAiCard({
              message: "Here's your plan.",
              taskCreated: updatedTask,
            })
          }
        } catch {
          // Fallback - still create task with generic steps
          const steps = createFallbackSteps(taskName, '')
          const newTask = await addTask(taskName, 'soon', undefined, undefined, undefined, undefined, detectedDeadline)
          if (newTask) {
            await updateTask(newTask.id, { steps, due_date: detectedDeadline } as Partial<Task>)
            const updatedTask: Task = { ...newTask, steps }
            setAiCard({
              message: "Here's your plan.",
              taskCreated: updatedTask,
            })
          }
        }
      }
    } catch {
      // AI failed - show friendly error with options
      setAiCard({
        message: "I couldn't analyze that right now. You can try again or I'll add it with basic steps.",
        quickReplies: ['Try again', 'Add with basic steps'],
        pendingTaskName: value,
      })
    }
  }, [buildContextFromTags, getMemoryForAI, getRelevantMemory, addTask, addEntry, addToConversation, updateTask, contextGathering, getPreference, conversationHistory, currentTask])

  // Handle quick reply
  const handleQuickReply = useCallback(async (reply: string) => {
    // Use refs to get current values without needing them as dependencies
    const currentAiCard = aiCardRef.current
    const currentPendingInput = pendingInputRef.current
    const currentTasks = tasksRef.current
    const currentTaskIdValue = currentTaskIdRef.current
    const currentTaskValue = currentTasks.find(t => t.id === currentTaskIdValue)

    const taskName = currentAiCard?.pendingTaskName || currentPendingInput || 'New task'

    if (reply === 'Try again' && currentPendingInput) {
      setAiCard(null)
      await handleSubmit(currentPendingInput)
      return
    }

    if (reply === 'Add task without steps' || reply === 'Add with basic steps') {
      // Always add with steps - use fallback steps at minimum
      const steps = createFallbackSteps(taskName, '')
      const newTask = await addTask(taskName, 'soon')
      if (newTask) {
        await updateTask(newTask.id, { steps } as Partial<Task>)
        const updatedTask: Task = { ...newTask, steps }
        setAiCard({
          message: "Here's your plan.",
          taskCreated: updatedTask,
        })
      } else {
        setAiCard({
          message: "I couldn't add the task. Please try again.",
        })
      }
      return
    }

    if (reply.startsWith('Mark "') && reply.endsWith('" complete') && currentTaskValue) {
      const targetText = reply.slice(6, -10)
      const targetStep = (currentTaskValue.steps || []).find((step) => step.text === targetText)
      if (targetStep) {
        await toggleStep(currentTaskValue.id, targetStep.id)
      }
      setAiCard(null)
      return
    }

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
        await handleSubmit(originalInput)
        return
      }
    }

    // Check if we're in context gathering mode
    if (contextGathering) {
      const { questions, currentIndex, answers } = contextGathering
      const currentQuestion = questions[currentIndex]

      if (contextGathering.awaitingFreeTextFor) {
        const updatedAnswers = { ...answers, [contextGathering.awaitingFreeTextFor.key]: reply }
        const nextIndex = currentIndex + 1
        if (nextIndex < questions.length) {
          const nextQuestion = questions[nextIndex]
          const nextQuestionText = nextQuestion.question || nextQuestion.text || ''
          setContextGathering({
            ...contextGathering,
            currentIndex: nextIndex,
            answers: updatedAnswers,
            awaitingFreeTextFor: undefined,
          })
          setAiCard({
            question: {
              text: nextQuestionText,
              index: nextIndex + 1,
              total: questions.length,
            },
            quickReplies: nextQuestion.options,
            pendingTaskName: taskName,
          })
          return
        }

        setContextGathering(null)
        const contextDescription = Object.entries(updatedAnswers)
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
              clarifyingAnswers: Object.entries(updatedAnswers).map(([q, a]) => ({ question: q, answer: a })),
            }),
          })

          let steps: Step[] = []

          if (response.ok) {
            const data = await response.json()
            steps = mapAIStepsToSteps(data.subtasks || [])
          } else {
            steps = createFallbackSteps(taskName, contextDescription)
          }

          const newTask = await addTask(taskName, 'soon')
          if (newTask) {
            const contextText = Object.entries(updatedAnswers)
              .map(([_, value]) => value)
              .filter((value) => value && !value.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase()))
              .join(' · ')

            try {
              await updateTask(newTask.id, {
                steps,
                context_text: contextText,
              } as Partial<Task>)
            } catch {
              // Steps column may need migration
            }

            const updatedTask: Task = {
              ...newTask,
              steps,
              context_text: contextText || null,
            }

            addEntry({
              type: 'task_created',
              taskTitle: taskName,
              context: updatedAnswers,
            })

            setAiCard({
              message: "Here's your plan.",
              taskCreated: updatedTask,
            })
          }
        } catch {
          setAiCard({
            message: "I couldn't create the task. Want to try again?",
            quickReplies: ['Try again', 'Add task without steps'],
            pendingTaskName: taskName,
          })
        }
        return
      }

      // Store the answer
      const updatedAnswers = { ...answers, [currentQuestion.key]: reply }

      if (reply.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase())) {
        // Set free text mode, clear saved answer, mark "Other" as selected
        setContextGathering({
          ...contextGathering,
          awaitingFreeTextFor: { key: currentQuestion.key, prompt: currentQuestion.question || currentQuestion.text || '' },
        })
        // Clear savedAnswer but keep quickReplies for autocomplete, mark other as selected
        setAiCard(prev => prev ? {
          ...prev,
          autoFocusInput: true,
          savedAnswer: reply, // Mark "Other" as selected
        } : prev)
        return
      }

      // Save preference for future use (e.g., state, country)
      if (currentQuestion.key && reply) {
        setPreference(currentQuestion.key, reply)
      }

      // Check if there are more questions
      if (currentIndex < questions.length - 1) {
        // Ask the next question
        const nextQuestion = questions[currentIndex + 1]
        const nextQuestionText = nextQuestion.question || nextQuestion.text || ''
        const nextSavedAnswer = nextQuestion.key ? getPreference(nextQuestion.key) : undefined
        setContextGathering({
          ...contextGathering,
          currentIndex: currentIndex + 1,
          answers: updatedAnswers,
        })
        setAiCard({
          question: {
            text: nextQuestionText,
            index: currentIndex + 2,
            total: questions.length,
          },
          quickReplies: nextQuestion.options,
          pendingTaskName: taskName,
          savedAnswer: nextSavedAnswer,
        })
        return
      }

      // All questions answered - clear gathering state and create task
      setContextGathering(null)
      const contextDescription = Object.entries(updatedAnswers)
        .filter(([, value]) => value && !value.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase()))
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')

      // Now create the task with full context
      setAiCard({ thinking: true, message: "Got it. Researching specific steps for your situation..." })

      try {
        // Add the gathered context to conversation history
        addToConversation('user', `Context: ${contextDescription}`)

        const response = await authFetch('/api/suggest-subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: taskName,
            description: contextDescription,
            clarifyingAnswers: Object.entries(updatedAnswers).map(([q, a]) => ({ question: q, answer: a })),
          }),
        })

        let steps: Step[] = []

        if (response.ok) {
          const data = await response.json()
          steps = mapAIStepsToSteps(data.subtasks || [])
        } else {
          steps = createFallbackSteps(taskName, contextDescription)
        }

        // Create the task
        const newTask = await addTask(taskName, 'soon')
        if (newTask) {
          // Build context text from answers
          const contextText = Object.entries(updatedAnswers)
            .map(([_, value]) => value)
            .filter((value) => value && !value.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase()))
            .join(' · ')

          try {
            await updateTask(newTask.id, {
              steps,
              context_text: contextText,
            } as Partial<Task>)
          } catch {
            // Steps column may need migration
          }

          const updatedTask: Task = {
            ...newTask,
            steps,
            context_text: contextText || null,
          }

          // Add to memory
          addEntry({
            type: 'task_created',
            taskTitle: taskName,
            context: updatedAnswers,
          })

          setAiCard({
            message: "Here's your plan.",
            taskCreated: updatedTask,
          })
        }
      } catch {
        setAiCard({
          message: "I couldn't create the task. Please try again.",
        })
      }
      return
    }

    // Legacy flow (no context gathering)
    setAiCard({ thinking: true })

    try {
      const response = await authFetch('/api/suggest-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskName,
          description: reply,
        }),
      })

      let steps: Step[] = []
      let contextText: string | undefined

      if (response.ok) {
        const data = await response.json()
        steps = mapAIStepsToSteps(data.subtasks || [])
        contextText = reply === 'ASAP' ? 'High priority' : undefined
      } else {
        steps = createFallbackSteps(taskName)
      }

      const newTask = await addTask(taskName, 'soon')
      if (newTask) {
        try {
          await updateTask(newTask.id, {
            steps,
            context_text: contextText,
          } as Partial<Task>)
        } catch {
          // Steps column may need migration
        }

        const updatedTask: Task = {
          ...newTask,
          steps,
          context_text: contextText || null,
        }

        setAiCard({
          message: "Here's your plan.",
          taskCreated: updatedTask,
        })
      }
    } catch {
      setAiCard({
        message: "I couldn't create the task. Please try again.",
      })
    }
  }, [contextGathering, duplicatePrompt, toggleStep, goToTask, setCurrentTaskId, handleSubmit, addTask, updateTask, addToConversation, addEntry, getPreference, setPreference])

  const handleBackQuestion = useCallback(() => {
    if (!contextGathering) return
    const { questions, currentIndex, answers, taskName, awaitingFreeTextFor } = contextGathering

    if (awaitingFreeTextFor) {
      const updatedAnswers = { ...answers }
      delete updatedAnswers[awaitingFreeTextFor.key]
      const question = questions[currentIndex]
      setContextGathering({
        ...contextGathering,
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
      ...contextGathering,
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
  }, [contextGathering])

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
      // This will be handled by the parent component through the focusStepId callback
      // For now, we don't handle it here - return void
      return
    }

    if (action.type === 'create_task' && action.title) {
      const newTask = await addTask(action.title, 'soon')
      if (newTask) {
        // Generate steps for the new task using fallback steps
        const steps = createFallbackSteps(action.title, action.context || '')
        await updateTask(newTask.id, {
          steps,
          context_text: action.context || undefined,
        } as Partial<Task>)
        setAiCard({
          message: `Created "${action.title}".`,
          taskCreated: {
            ...newTask,
            steps,
            context_text: action.context || null,
          },
        })
      }
      return
    }

    if (action.type === 'show_sources') {
      setAiCard((prev) => (prev ? { ...prev, showSources: true } : prev))
    }
  }, [addTask, currentTask, toggleStep, updateTask])

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
