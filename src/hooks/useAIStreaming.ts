'use client'

import { useCallback } from 'react'
import { AICardState } from '@/components/AICard'
import { authFetch } from '@/lib/supabase'
import { consumeStream, parseAIMessage, parseStreamingMessage } from '@/lib/ai'
import { filterActions } from '@/lib/taskHelpers'
import type { ChatAction } from '@/lib/api-types'
import type { Task } from '@/hooks/useUserData'

export interface StreamingContext {
  task?: {
    id: string
    title: string
    context_text: string | null | undefined
    steps: Array<{ id: string | number; text: string; done: boolean; summary: string | undefined }>
    focused_step?: { id: string | number; text: string; done: boolean; summary: string | undefined } | null
  } | null
  ui: { view: string; has_ai_card: boolean }
  user: { message: string; pendingTaskName?: string }
}

export interface StreamChatOptions {
  message: string
  context: StreamingContext
  history: Array<{ role: string; content: string }>
  currentTask?: Task
  pendingTaskName?: string
  quickReplies?: string[]
}

export interface StreamChatResult {
  success: boolean
  message?: string
  sources?: Array<{ title: string; url: string }>
  actions?: ChatAction[]
  upgradeRequired?: boolean
}

export interface UseAIStreamingDeps {
  setAiCard: React.Dispatch<React.SetStateAction<AICardState | null>>
  onUpgradeRequired?: () => void
}

/**
 * Hook for handling AI streaming responses.
 *
 * Provides utilities for streaming chat responses from the AI,
 * handling SSE events, and managing AI card state during streaming.
 */
export function useAIStreaming(deps: UseAIStreamingDeps) {
  const { setAiCard, onUpgradeRequired } = deps

  /**
   * Stream a chat response from the AI and update the AI card as tokens arrive.
   */
  const streamChatResponse = useCallback(async (options: StreamChatOptions): Promise<StreamChatResult> => {
    const { message, context, history, currentTask, pendingTaskName, quickReplies } = options

    // Set streaming state
    setAiCard({ streaming: true, streamingText: '', pendingTaskName })

    try {
      const response = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          message,
          context,
          history,
          stream: true,
        }),
      })

      if (!response.ok) {
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
              return { success: false, upgradeRequired: true }
            }
          } catch {
            // Continue with default error handling
          }
        }
        setAiCard({
          streaming: false,
          message: "Sorry, I couldn't get an answer. Try rephrasing your question.",
        })
        return { success: false }
      }

      let streamedSources: Array<{ title: string; url: string }> = []
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

      // Filter actions based on current task context
      const actions = filterActions(
        Array.isArray(streamedActions) ? streamedActions : [],
        currentTask
      ) as ChatAction[]

      // Finalize the AI card
      setAiCard({
        streaming: false,
        streamingText: undefined,
        message: parseAIMessage(fullText),
        sources: streamedSources,
        pendingTaskName,
        quickReplies: actions.length > 0 ? undefined : quickReplies,
        actions: actions.map((action) => ({
          ...action,
          label: action.label || getActionLabel(action.type),
        })),
        showSources: !actions.some((action) => action.type === 'show_sources'),
      })

      return {
        success: true,
        message: parseAIMessage(fullText),
        sources: streamedSources,
        actions,
      }
    } catch {
      setAiCard({
        streaming: false,
        message: "Something went wrong. Please try again.",
      })
      return { success: false }
    }
  }, [setAiCard, onUpgradeRequired])

  return {
    streamChatResponse,
  }
}

/**
 * Get a human-readable label for an action type.
 */
function getActionLabel(type: string): string {
  switch (type) {
    case 'mark_step_done':
      return 'Mark step complete'
    case 'focus_step':
      return 'Jump to step'
    case 'create_task':
      return 'Create task'
    case 'show_sources':
      return 'Show sources'
    default:
      return type
  }
}
