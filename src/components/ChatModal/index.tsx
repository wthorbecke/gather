'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Modal } from '../Modal'
import { ChatMessage, ChatMessageData } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { Task } from '@/hooks/useUserData'
import type { ActiveTaskCategory } from '@/lib/constants'
import { authFetch } from '@/lib/supabase'

interface CreateTaskAction {
  type: 'create_task'
  title: string
  context: string
}

interface ChatModalProps {
  isOpen: boolean
  onClose: () => void
  onGoToTask: (taskId: string) => void
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
}

export function ChatModal({ isOpen, onClose, onGoToTask, addTask, updateTask }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Clean up on close
  useEffect(() => {
    if (!isOpen) {
      // Cancel any in-flight requests
      abortControllerRef.current?.abort()
    }
  }, [isOpen])

  const handleCreateTask = useCallback(async (action: CreateTaskAction): Promise<Task | undefined> => {
    const newTask = await addTask(action.title, 'soon')
    if (newTask) {
      // Store conversation context with the task
      await updateTask(newTask.id, {
        context_text: action.context,
      })
      return { ...newTask, context_text: action.context }
    }
    return undefined
  }, [addTask, updateTask])

  const parseAIResponse = useCallback((text: string): { message: string; action?: CreateTaskAction } => {
    // Try to extract JSON action block from the response
    const jsonMatch = text.match(/\{[\s\S]*"type"\s*:\s*"create_task"[\s\S]*\}/)

    if (jsonMatch) {
      try {
        const action = JSON.parse(jsonMatch[0]) as CreateTaskAction
        // Remove the JSON block from the visible message
        const cleanMessage = text.replace(jsonMatch[0], '').trim()
        return { message: cleanMessage || 'Creating your task...', action }
      } catch {
        // JSON parsing failed, return full text
      }
    }

    return { message: text }
  }, [])

  const handleSend = useCallback(async (content: string) => {
    // Add user message
    const userMessage: ChatMessageData = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Create assistant message placeholder for streaming
    const assistantMessageId = `msg-${Date.now() + 1}`
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }])

    // Build conversation history for API
    const history = messages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      abortControllerRef.current = new AbortController()

      const response = await authFetch('/api/chat-assistant', {
        method: 'POST',
        body: JSON.stringify({
          message: content,
          history,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)

          try {
            const event = JSON.parse(data)

            if (event.text) {
              fullText += event.text
              // Update streaming message
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: fullText }
                  : m
              ))
            }

            if (event.done) {
              // Parse final response for actions
              const { message, action } = parseAIResponse(fullText)

              let taskCreated: Task | undefined
              if (action?.type === 'create_task') {
                taskCreated = await handleCreateTask(action)
              }

              // Finalize message
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: message, isStreaming: false, taskCreated }
                  : m
              ))
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled, clean up the streaming message
        setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
      } else {
        // Show error message
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: 'Sorry, something went wrong. Try again?', isStreaming: false }
            : m
        ))
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [messages, parseAIResponse, handleCreateTask])

  const handleGoToTask = useCallback((taskId: string) => {
    onClose()
    onGoToTask(taskId)
  }, [onClose, onGoToTask])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="420px"
      showHeader={false}
    >
      <div className="flex flex-col h-[70vh] max-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Chat</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Close chat"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center mb-4">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="text-accent">
                  <path
                    d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-text-soft text-sm">
                Tell me what you need to do and I&apos;ll help you get started.
              </p>
            </div>
          ) : (
            messages.map(message => (
              <ChatMessage
                key={message.id}
                message={message}
                onGoToTask={handleGoToTask}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder="What do you need to do?"
        />
      </div>
    </Modal>
  )
}
