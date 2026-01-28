'use client'

import { useState, useCallback, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { useTasks, Task, Step } from '@/hooks/useUserData'
import { useMemory } from '@/hooks/useMemory'
import { ThemeToggle } from './ThemeProvider'
import { HomeView } from './HomeView'
import { TaskView } from './TaskView'
import { AICardState } from './AICard'
import { Confetti, CompletionCelebration } from './Confetti'
import {
  isQuestion,
  isStepRequest,
  filterActions,
  sanitizeQuestions,
  findDuplicateTask,
  buildTaskContext,
  detectCompletionIntent,
  findMatchingStep,
  createStepFromAIResponse,
  createFallbackSteps,
  COMPLETION_KEYWORD_MAP,
} from '@/lib/taskHelpers'
import { OTHER_SPECIFY_OPTION } from '@/config/content'

interface ContextTag {
  type: 'task' | 'step'
  label: string
  task?: Task
  step?: Step
}

interface GatherAppProps {
  user: User
  onSignOut: () => void
}

export function GatherApp({ user, onSignOut }: GatherAppProps) {
  const { tasks, addTask, updateTask, toggleStep, deleteTask, loading } = useTasks(user)
  const { addEntry, addToConversation, getMemoryForAI, getRelevantMemory } = useMemory()
  const isDemoUser = Boolean(user?.id?.startsWith('demo-') || user?.email?.endsWith('@gather.local'))

  // View state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  // AI state
  const [aiCard, setAiCard] = useState<AICardState | null>(null)
  const [pendingInput, setPendingInput] = useState<string | null>(null)
  const [contextTags, setContextTags] = useState<ContextTag[]>([])
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([])
  const [isFollowUp, setIsFollowUp] = useState(false)
  const [focusStepId, setFocusStepId] = useState<string | number | null>(null)
  const bypassDuplicateRef = useRef(false)
  
  // Context gathering state - stores AI-generated questions and answers
  const [contextGathering, setContextGathering] = useState<{
    questions: Array<{ key: string; question?: string; text?: string; options: string[] }>
    currentIndex: number
    answers: Record<string, string>
    taskName: string
    awaitingFreeTextFor?: { key: string; prompt: string }
  } | null>(null)
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    taskId: string
    taskTitle: string
    input: string
  } | null>(null)

  // Celebration state
  const [showConfetti, setShowConfetti] = useState(false)
  const [completedTaskName, setCompletedTaskName] = useState<string | null>(null)

  const currentTask = tasks.find((t) => t.id === currentTaskId)

  // Navigate to task
  const goToTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    setCurrentTaskId(taskId)
    setAiCard(null)
    setPendingInput(null)
    setConversationHistory([])
    setIsFollowUp(false)
    // Set the task as initial context
    if (task) {
      setContextTags([{ type: 'task', label: task.title, task }])
    }
  }, [tasks])

  // Go back to home
  const goHome = useCallback(() => {
    setCurrentTaskId(null)
    setAiCard(null)
    setPendingInput(null)
    setContextTags([])
    setConversationHistory([])
    setIsFollowUp(false)
  }, [])

  // Set or clear step context (only one step at a time)
  const handleSetStepContext = useCallback((step: Step | null) => {
    setContextTags(prev => {
      // Remove any existing step tags
      const withoutSteps = prev.filter(t => t.type !== 'step')
      // If step is null, just return without step
      if (!step) return withoutSteps
      // Add the new step context
      return [...withoutSteps, { type: 'step', label: step.text, step }]
    })
  }, [])

  // Remove context tag - removing task tag clears all context
  const handleRemoveTag = useCallback((index: number) => {
    setContextTags(prev => {
      const tagToRemove = prev[index]
      // If removing the task tag, clear all context
      if (tagToRemove?.type === 'task') {
        return []
      }
      // Otherwise just remove the specific tag
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // Helper functions are imported from @/lib/taskHelpers

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
    if (contextGathering && aiCard?.question) {
      await handleQuickReply(value)
      return
    }
    // Check if this is a follow-up to an existing conversation (AI card showing with a message)
    const isFollowUpMessage = aiCard !== null && !aiCard.thinking && aiCard.message
    const isTaskView = Boolean(currentTaskId && currentTask)

    // Store current AI card state before clearing
    const currentAiCard = aiCard
    const currentPendingInput = pendingInput

    setPendingInput(value)

    // Duplicate detection for new tasks on home view
    if (!bypassDuplicateRef.current && !isFollowUpMessage && contextTags.length === 0 && !isQuestion(value)) {
      const duplicateTask = findDuplicateTask(value, tasks)
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
    if (isTaskView && currentTask) {
      try {
        const focusedStep = contextTags.find(t => t.type === 'step')?.step || null
        const context = {
          task: {
            id: currentTask.id,
            title: currentTask.title,
            context_text: currentTask.context_text,
            steps: (currentTask.steps || []).map((step) => ({
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
            has_ai_card: Boolean(aiCard),
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

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: value,
                context,
                history,
              }),
            })

          if (response.ok) {
            const data = await response.json()

            // Check if user message suggests they completed something
            let completionPrompt: string | undefined
            if (detectCompletionIntent(value) && currentTask.steps?.length) {
              const match = findMatchingStep(value, currentTask.steps)
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
            const actions = filterActions(Array.isArray(data.actions) ? data.actions : [], currentTask)
            setAiCard({
              message: data.response,
              sources: data.sources || [],
              pendingTaskName: currentAiCard?.pendingTaskName,
              quickReplies: actions.length > 0 ? undefined : (completionPrompt ? [completionPrompt] : currentAiCard?.quickReplies),
              actions: actions.map((action: any) => ({
                ...action,
                label: action.label || (action.type === 'mark_step_done' ? `Mark step complete` : action.type === 'focus_step' ? 'Jump to step' : action.type === 'create_task' ? `Create task` : action.type === 'show_sources' ? 'Show sources' : action.type),
              })),
              showSources: actions.some((action: any) => action.type === 'show_sources') ? false : true,
            })
          } else {
            setAiCard({
              message: "Sorry, I couldn't get an answer. Try rephrasing your question.",
            })
          }
        } else {
          const existingStepTexts = (currentTask.steps || []).map(s => s.text)
          const response = await fetch('/api/suggest-subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: currentTask.title,
              description: currentTask.description,
              notes: value,
              existingSubtasks: existingStepTexts,
            }),
          })

          if (response.ok) {
            const data = await response.json()
                const newSteps: Step[] = data.subtasks.map((item: {
              text?: string
              summary?: string
              detail?: string
              alternatives?: string[]
              examples?: string[]
              checklist?: string[]
              time?: string
              source?: { name: string; url: string }
              action?: { text: string; url: string }
            } | string, i: number) => {
              if (typeof item === 'string') {
                return { id: `step-${Date.now()}-${i}`, text: item, done: false }
              }
              return {
                id: `step-${Date.now()}-${i}`,
                text: item.text || String(item),
                done: false,
                summary: item.summary,
                detail: item.detail,
                alternatives: item.alternatives,
                examples: item.examples,
                checklist: item.checklist,
                time: item.time,
                source: item.source,
                action: item.action,
              }
            })

            await updateTask(currentTask.id, {
              steps: [...(currentTask.steps || []), ...newSteps],
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
    if (isFollowUpMessage || (contextTags.length > 0 && isQuestion(value))) {
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
            view: currentTaskId ? 'task' : 'home',
            has_ai_card: Boolean(aiCard),
          },
          user: { message: value },
        }
        if (contextTags.length > 0) {
          const taskTag = contextTags.find((tag) => tag.type === 'task')?.task
          const stepTag = contextTags.find((tag) => tag.type === 'step')?.step
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
                view: currentTaskId ? 'task' : 'home',
                has_ai_card: Boolean(aiCard),
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
              ...conversationHistory,
              ...(currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
              ...(currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
            ]
          : []

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: value,
              context,
              history,
            }),
          })

        if (response.ok) {
          const data = await response.json()
          // Update conversation history
          setConversationHistory(prev => [
            ...prev,
            ...(isFollowUpMessage && currentPendingInput ? [{ role: 'user', content: currentPendingInput }] : []),
            ...(isFollowUpMessage && currentAiCard?.message ? [{ role: 'assistant', content: currentAiCard.message }] : []),
          ])
          setIsFollowUp(true)
          const actions = filterActions(Array.isArray(data.actions) ? data.actions : [], contextTags.find((tag) => tag.type === 'task')?.task || currentTask)
          setAiCard({
            message: data.response,
            sources: data.sources || [],
            // Preserve pending task name for continued conversation
            pendingTaskName: currentAiCard?.pendingTaskName,
            // Keep quick replies available
            quickReplies: actions.length > 0 ? undefined : currentAiCard?.quickReplies,
            actions: actions.map((action: any) => ({
              ...action,
              label: action.label || (action.type === 'mark_step_done' ? `Mark step complete` : action.type === 'focus_step' ? 'Jump to step' : action.type === 'create_task' ? `Create task` : action.type === 'show_sources' ? 'Show sources' : action.type),
            })),
            showSources: actions.some((action: any) => action.type === 'show_sources') ? false : true,
          })
        } else {
          setAiCard({
            message: "Sorry, I couldn't get an answer. Try rephrasing your question.",
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
    const taskContext = contextTags.find(t => t.type === 'task')
    if (taskContext?.task && !isQuestion(value)) {
      const targetTask = taskContext.task
      try {
        // Pass existing steps to avoid duplicates
        const existingStepTexts = (targetTask.steps || []).map(s => s.text)

        const response = await fetch('/api/suggest-subtasks', {
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
          // Map all rich step fields from the API response
          const newSteps: Step[] = data.subtasks.map((item: {
            text?: string
            summary?: string
            detail?: string
            alternatives?: string[]
            examples?: string[]
            checklist?: string[]
            time?: string
            source?: { name: string; url: string }
            action?: { text: string; url: string }
          } | string, i: number) => {
            if (typeof item === 'string') {
              return { id: `step-${Date.now()}-${i}`, text: item, done: false }
            }
            return {
              id: `step-${Date.now()}-${i}`,
              text: item.text || String(item),
              done: false,
              summary: item.summary,
              detail: item.detail,
              alternatives: item.alternatives,
              examples: item.examples,
              checklist: item.checklist,
              time: item.time,
              source: item.source,
              action: item.action,
            }
          })

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
    
    console.log('[Gather] Analyzing intent for:', value)
    console.log('[Gather] Memory context:', memoryContext)
    
    try {
      // Call general-purpose AI analysis endpoint
      const response = await fetch('/api/analyze-intent', {
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
        console.error('[Gather] API response not OK:', response.status)
        throw new Error('Failed to analyze intent')
      }

      const data = await response.json()
      console.log('[Gather] AI response:', data)
      
      // Add to conversation history
      addToConversation('user', value)
      addToConversation('assistant', data.understanding || 'Asked clarifying questions')

      // ALWAYS ask questions if the task is vague or we need more info
      const shouldAskQuestions = data.needsMoreInfo !== false || !data.ifComplete?.steps || data.ifComplete.steps.length < 2

      if (shouldAskQuestions && data.questions?.length > 0) {
        const sanitizedQuestions = sanitizeQuestions(data.taskName || value, data.questions)
        console.log('[Gather] Asking clarifying questions:', data.questions)
        const firstQuestionText = sanitizedQuestions[0].question || sanitizedQuestions[0].text || ''
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
        })
      } else if (data.ifComplete?.steps && data.ifComplete.steps.length > 0) {
        // AI has enough info to create steps immediately
        console.log('[Gather] Creating task with steps:', data.ifComplete.steps)
        const steps: Step[] = data.ifComplete.steps.map((s: any, i: number) => ({
          id: `step-${Date.now()}-${i}`,
          text: s.text,
          done: false,
          summary: s.summary,
          detail: s.detail,
          time: s.time,
        }))

        // Extract deadline if detected
        const detectedDeadline = data.deadline?.date || null

        const newTask = await addTask(
          data.taskName || value,
          'soon',
          undefined, // description
          undefined, // badge
          undefined, // clarifyingAnswers
          undefined, // taskCategory
          detectedDeadline
        )
        if (newTask) {
          await updateTask(newTask.id, {
            steps,
            context_text: data.ifComplete.contextSummary,
            due_date: detectedDeadline,
          } as Partial<Task>)

          const updatedTask: Task = {
            ...newTask,
            steps,
            context_text: data.ifComplete.contextSummary || null,
          }

          // Add to memory
          addEntry({
            type: 'task_created',
            taskTitle: data.taskName || value,
            context: {},
          })

          setAiCard({
            message: "Here's your plan.",
            taskCreated: updatedTask,
          })
        }
      } else {
        // AI didn't generate questions or steps - just create simple task
        console.log('[Gather] AI returned no actionable content, creating simple task')
        const detectedDeadline = data.deadline?.date || null
        const newTask = await addTask(
          data.taskName || value,
          'soon',
          undefined,
          undefined,
          undefined,
          undefined,
          detectedDeadline
        )
        if (newTask && detectedDeadline) {
          await updateTask(newTask.id, { due_date: detectedDeadline } as Partial<Task>)
        }
        if (newTask) {
          setAiCard({
            message: "I've added that to your list. Click on it to add steps or ask me for help breaking it down.",
            taskCreated: newTask,
          })
        }
      }
    } catch (error) {
      console.error('Error analyzing intent:', error)
      // AI failed - show friendly error with options
      setAiCard({
        message: "I couldn't analyze that right now. You can try again or I'll just add it to your list.",
        quickReplies: ['Try again', 'Add task without steps'],
        pendingTaskName: value,
      })
    }
  }, [aiCard, pendingInput, contextTags, conversationHistory, buildContextFromTags, getMemoryForAI, getRelevantMemory, addTask, addEntry, addToConversation, updateTask, tasks, currentTaskId, currentTask])

  // Handle quick reply
  const handleQuickReply = useCallback(async (reply: string) => {
    const taskName = aiCard?.pendingTaskName || pendingInput || 'New task'

    if (reply === 'Try again' && pendingInput) {
      setAiCard(null)
      await handleSubmit(pendingInput)
      return
    }

    if (reply === 'Add task without steps') {
      const newTask = await addTask(taskName, 'soon')
      if (newTask) {
        setAiCard({
          message: "Okay — I've added it. You can ask me to break it down anytime.",
          taskCreated: newTask,
        })
      } else {
        setAiCard({
          message: "I couldn't add the task. Please try again.",
        })
      }
      return
    }

    if (reply.startsWith('Mark "') && reply.endsWith('" complete') && currentTask) {
      const targetText = reply.slice(6, -10)
      const targetStep = (currentTask.steps || []).find((step) => step.text === targetText)
      if (targetStep) {
        await toggleStep(currentTask.id, targetStep.id)
      }
      setAiCard(null)
      return
    }

    if (duplicatePrompt) {
      if (reply === 'Update existing') {
        setDuplicatePrompt(null)
        setAiCard(null)
        setPendingInput(null)
        goToTask(duplicatePrompt.taskId)
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
          console.log('[Gather] Generating steps with context:', contextDescription)
          const response = await fetch('/api/suggest-subtasks', {
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
            console.log('[Gather] Generated steps:', data.subtasks)
            steps = (data.subtasks || []).map((item: string | {
              text?: string
              summary?: string
              detail?: string
              alternatives?: string[]
              examples?: string[]
              checklist?: string[]
              time?: string
              source?: { name: string; url: string }
              action?: { text: string; url: string }
            }, i: number) => {
              if (typeof item === 'string') {
                return { id: `step-${Date.now()}-${i}`, text: item, done: false }
              }
              return {
                id: `step-${Date.now()}-${i}`,
                text: item.text || String(item),
                done: false,
                summary: item.summary,
                detail: item.detail,
                alternatives: item.alternatives,
                examples: item.examples,
                checklist: item.checklist,
                time: item.time,
                source: item.source,
                action: item.action,
              }
            })
          } else {
            console.error('[Gather] suggest-subtasks API failed:', response.status)
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
            } catch (e) {
              console.warn('Could not save steps - migration may be needed:', e)
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
        } catch (error) {
          console.error('Error creating task:', error)
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
        setContextGathering({
          ...contextGathering,
          answers: updatedAnswers,
          awaitingFreeTextFor: { key: currentQuestion.key, prompt: currentQuestion.question || currentQuestion.text || 'Please specify.' },
        })
        setAiCard({
          question: {
            text: 'Please specify.',
            index: currentIndex + 1,
            total: questions.length,
          },
          quickReplies: [],
          pendingTaskName: taskName,
        })
        return
      }

      // Check if there are more questions
      if (currentIndex < questions.length - 1) {
        // Ask the next question
        const nextQuestion = questions[currentIndex + 1]
        const nextQuestionText = nextQuestion.question || nextQuestion.text || ''
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
        
        console.log('[Gather] Generating steps with context:', contextDescription)
        
        const response = await fetch('/api/suggest-subtasks', {
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
          console.log('[Gather] Generated steps:', data.subtasks)
          steps = (data.subtasks || []).map((item: string | {
            text?: string
            summary?: string
            detail?: string
            alternatives?: string[]
            examples?: string[]
            checklist?: string[]
            time?: string
            source?: { name: string; url: string }
            action?: { text: string; url: string }
          }, i: number) => {
            if (typeof item === 'string') {
              return { id: `step-${Date.now()}-${i}`, text: item, done: false }
            }
            return {
              id: `step-${Date.now()}-${i}`,
              text: item.text || String(item),
              done: false,
              summary: item.summary,
              detail: item.detail,
              alternatives: item.alternatives,
              examples: item.examples,
              checklist: item.checklist,
              time: item.time,
              source: item.source,
              action: item.action,
            }
          })
        } else {
          console.error('[Gather] suggest-subtasks API failed:', response.status)
          // Fallback - create generic steps but note that more info would help
          steps = [
            { id: `step-${Date.now()}-1`, text: `Research how to ${taskName.toLowerCase()}`, done: false, summary: "Find official process for your specific situation" },
            { id: `step-${Date.now()}-2`, text: `Gather required information (documents, account numbers, etc.)`, done: false, summary: "Based on: " + contextDescription },
            { id: `step-${Date.now()}-3`, text: `Complete the ${taskName.toLowerCase()} process`, done: false, summary: "Follow the official steps" },
            { id: `step-${Date.now()}-4`, text: `Keep documentation and confirm completion`, done: false, summary: "Verify it worked" },
          ]
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
          } catch (e) {
            console.warn('Could not save steps - migration may be needed:', e)
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
      } catch (error) {
        console.error('Error creating task:', error)
        setAiCard({
          message: "I couldn't create the task. Please try again.",
        })
      }
      return
    }

    // Legacy flow (no context gathering)
    setAiCard({ thinking: true })

    try {
      const response = await fetch('/api/suggest-subtasks', {
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
        steps = (data.subtasks || []).map((item: string | {
          text?: string
          summary?: string
          detail?: string
          alternatives?: string[]
          examples?: string[]
          checklist?: string[]
          time?: string
          source?: { name: string; url: string }
          action?: { text: string; url: string }
        }, i: number) => {
          if (typeof item === 'string') {
            return { id: `step-${Date.now()}-${i}`, text: item, done: false }
          }
          return {
            id: `step-${Date.now()}-${i}`,
            text: item.text || String(item),
            done: false,
            summary: item.summary,
            detail: item.detail,
            alternatives: item.alternatives,
            examples: item.examples,
            checklist: item.checklist,
            time: item.time,
            source: item.source,
            action: item.action,
          }
        })
        contextText = reply === 'ASAP' ? 'High priority' : undefined
      } else {
        steps = [
          { id: `step-${Date.now()}-1`, text: 'Research requirements', done: false, summary: "Understand what's needed." },
          { id: `step-${Date.now()}-2`, text: 'Gather documents', done: false, summary: 'Collect everything required.' },
          { id: `step-${Date.now()}-3`, text: 'Submit application', done: false, summary: 'Complete the process.' },
          { id: `step-${Date.now()}-4`, text: 'Follow up', done: false, summary: 'Confirm completion.' },
        ]
      }

      const newTask = await addTask(taskName, 'soon')
      if (newTask) {
        try {
          await updateTask(newTask.id, {
            steps,
            context_text: contextText,
          } as Partial<Task>)
        } catch (e) {
          console.warn('Could not save steps - migration may be needed:', e)
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
    } catch (error) {
      console.error('Error creating task:', error)
      setAiCard({
        message: "I couldn't create the task. Please try again.",
      })
    }
  }, [contextGathering, aiCard, pendingInput, duplicatePrompt, currentTask, toggleStep, goToTask, handleSubmit, addTask, updateTask, addToConversation, addEntry])

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
      setFocusStepId(action.stepId)
      return
    }

    if (action.type === 'create_task' && action.title) {
      const newTask = await addTask(action.title, 'soon')
      if (newTask) {
        if (action.context) {
          await updateTask(newTask.id, { context_text: action.context } as Partial<Task>)
        }
        setAiCard({
          message: `Created "${action.title}".`,
          taskCreated: {
            ...newTask,
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

  // Handle quick add (simple task without AI)
  const handleQuickAdd = useCallback(async (value: string) => {
    const newTask = await addTask(value, 'soon')
    if (newTask) {
      // Try to add a single step matching the task title
      try {
        await updateTask(newTask.id, {
          steps: [{ id: `step-${Date.now()}`, text: value, done: false }],
        } as Partial<Task>)
      } catch (e) {
        console.warn('Could not save steps - migration may be needed:', e)
      }
    }
  }, [addTask, updateTask])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSubmit(suggestion)
  }, [handleSubmit])

  // Handle step toggle
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

    // If we're completing (not uncompleting) and this completes the task, celebrate!
    if (!wasComplete && task.steps) {
      const otherStepsDone = task.steps.filter((s) => s.id !== stepId).every((s) => s.done)
      const allDone = otherStepsDone // The current step is now done too
      if (allDone && task.steps.length > 1) {
        setShowConfetti(true)
        setCompletedTaskName(task.title)
        // Record completion in memory
        addEntry({
          type: 'task_completed',
          taskTitle: task.title,
        })
      }
    }
  }, [toggleStep, tasks, addEntry])

  // Dismiss AI card
  const dismissAI = useCallback(() => {
    setAiCard(null)
    setPendingInput(null)
    setConversationHistory([])
    setIsFollowUp(false)
    setContextGathering(null)
    setDuplicatePrompt(null)
  }, [])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text mb-4">Gather</h1>
          <div className="flex justify-center gap-1">
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header - only show on home view */}
      {!currentTaskId && (
        <div className="px-5 pt-8">
          <div className="max-w-[540px] mx-auto">
            <div className="flex justify-between items-center">
              <h1 className="text-4xl font-display font-semibold tracking-tight">Gather</h1>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <button
                  onClick={onSignOut}
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  {isDemoUser ? 'Exit demo' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme toggle in task view */}
      {/* Theme toggle is rendered within TaskView to avoid overlap */}

      {/* Views */}
      {!currentTaskId ? (
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
          canGoBack={Boolean(contextGathering && (contextGathering.currentIndex > 0 || contextGathering.awaitingFreeTextFor))}
        />
      ) : currentTask ? (
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
          onSetStepContext={handleSetStepContext}
          onRemoveTag={handleRemoveTag}
          onDeleteTask={() => handleDeleteTask(currentTask.id)}
          onSnoozeTask={(date) => handleSnoozeTask(currentTask.id, date)}
          focusStepId={focusStepId}
        />
      ) : null}

      {/* Celebration */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <CompletionCelebration
        taskName={completedTaskName}
        onDismiss={() => setCompletedTaskName(null)}
      />

    </div>
  )
}
