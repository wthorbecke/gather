/**
 * Streaming utilities for Anthropic API responses via SSE
 *
 * Provides:
 * - Server-side: createStreamingResponse() for API routes
 * - Client-side: streamChat() and streamSubtasks() for consuming SSE streams
 */

import { AI_MODELS } from '@/config/ai'
import { authFetch } from '@/lib/supabase'
import { parseAIResponseFull } from './parseResponse'

// ============================================================================
// Types
// ============================================================================

export interface StreamingMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamingOptions {
  apiKey: string
  model?: string
  maxTokens?: number
  system?: string
  messages: StreamingMessage[]
  tools?: AnthropicTool[]
  onToolUse?: (toolName: string, input: Record<string, unknown>) => Promise<string>
}

interface AnthropicTool {
  name: string
  description?: string
  type?: string
  input_schema?: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

// SSE Event types
export type SSEEventType = 'token' | 'done' | 'error' | 'tool_use' | 'sources'

export interface SSEEvent {
  type: SSEEventType
  data: string | Record<string, unknown>
}

// ============================================================================
// Server-side: Create streaming response from Anthropic API
// ============================================================================

/**
 * Creates a streaming response from the Anthropic API
 * Returns a ReadableStream that emits SSE-formatted events
 */
export function createStreamingResponse(options: StreamingOptions): ReadableStream {
  const {
    apiKey,
    model = AI_MODELS.conversation,
    maxTokens = 512,
    system,
    messages,
    tools,
    onToolUse,
  } = options

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        // Format messages for Anthropic API
        const apiMessages = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

        const requestBody: Record<string, unknown> = {
          model,
          max_tokens: maxTokens,
          stream: true,
          messages: apiMessages,
        }

        if (system) {
          requestBody.system = system
        }

        if (tools && tools.length > 0) {
          requestBody.tools = tools
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorText = await response.text()
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: errorText })}\n\n`)
          )
          controller.close()
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'No response body' })}\n\n`)
          )
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let fullText = ''
        let toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
        let currentToolUse: { id: string; name: string; inputJson: string } | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              // Handle different event types
              switch (event.type) {
                case 'content_block_start':
                  if (event.content_block?.type === 'tool_use') {
                    currentToolUse = {
                      id: event.content_block.id,
                      name: event.content_block.name,
                      inputJson: '',
                    }
                  }
                  break

                case 'content_block_delta':
                  if (event.delta?.type === 'text_delta') {
                    const text = event.delta.text
                    fullText += text
                    // Send token event
                    controller.enqueue(
                      encoder.encode(`event: token\ndata: ${JSON.stringify({ text })}\n\n`)
                    )
                  } else if (event.delta?.type === 'input_json_delta' && currentToolUse) {
                    currentToolUse.inputJson += event.delta.partial_json || ''
                  }
                  break

                case 'content_block_stop':
                  if (currentToolUse) {
                    try {
                      const input = JSON.parse(currentToolUse.inputJson || '{}')
                      toolUseBlocks.push({
                        id: currentToolUse.id,
                        name: currentToolUse.name,
                        input,
                      })
                    } catch {
                      // Invalid JSON, skip this tool use
                    }
                    currentToolUse = null
                  }
                  break

                case 'message_stop':
                  // Handle tool use if needed
                  if (toolUseBlocks.length > 0 && onToolUse) {
                    for (const tool of toolUseBlocks) {
                      controller.enqueue(
                        encoder.encode(
                          `event: tool_use\ndata: ${JSON.stringify({ name: tool.name, input: tool.input })}\n\n`
                        )
                      )

                      // Execute tool and continue conversation
                      const toolResult = await onToolUse(tool.name, tool.input)

                      // Continue the conversation with tool results
                      const continueMessages = [
                        ...apiMessages,
                        {
                          role: 'assistant',
                          content: [
                            ...(fullText ? [{ type: 'text', text: fullText }] : []),
                            { type: 'tool_use', id: tool.id, name: tool.name, input: tool.input },
                          ],
                        },
                        {
                          role: 'user',
                          content: [{ type: 'tool_result', tool_use_id: tool.id, content: toolResult }],
                        },
                      ]

                      // Make continuation request (non-streaming for simplicity)
                      const continueResponse = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-api-key': apiKey,
                          'anthropic-version': '2023-06-01',
                        },
                        body: JSON.stringify({
                          model,
                          max_tokens: maxTokens,
                          system,
                          tools,
                          messages: continueMessages,
                        }),
                      })

                      if (continueResponse.ok) {
                        const continueData = await continueResponse.json()
                        const textBlock = continueData.content?.find(
                          (block: { type: string }) => block.type === 'text'
                        )
                        if (textBlock?.text) {
                          controller.enqueue(
                            encoder.encode(`event: token\ndata: ${JSON.stringify({ text: textBlock.text })}\n\n`)
                          )
                          fullText += textBlock.text
                        }
                      }
                    }
                  }
                  break
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Send done event with full text
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ text: fullText })}\n\n`)
        )
        controller.close()
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' })}\n\n`
          )
        )
        controller.close()
      }
    },
  })
}

// ============================================================================
// Client-side: Consume SSE streams
// ============================================================================

export interface StreamCallbacks {
  onToken?: (text: string) => void
  onDone?: (fullText: string) => void
  onError?: (error: string) => void
  onToolUse?: (name: string, input: Record<string, unknown>) => void
  onSources?: (sources: Array<{ title: string; url: string }>) => void
}

/**
 * Consumes an SSE stream from a fetch response
 */
export async function consumeStream(
  response: Response,
  callbacks: StreamCallbacks
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let eventType = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ') && eventType) {
        try {
          const data = JSON.parse(line.slice(6))

          switch (eventType) {
            case 'token':
              fullText += data.text || ''
              callbacks.onToken?.(data.text || '')
              break

            case 'done':
              callbacks.onDone?.(data.text || fullText)
              break

            case 'error':
              callbacks.onError?.(data.message || 'Unknown error')
              break

            case 'tool_use':
              callbacks.onToolUse?.(data.name, data.input)
              break

            case 'sources':
              callbacks.onSources?.(data.sources || [])
              break
          }
        } catch {
          // Skip malformed JSON
        }
        eventType = ''
      }
    }
  }

  return fullText
}

/**
 * Helper to stream chat responses
 */
export async function streamChat(
  message: string,
  context: Record<string, unknown>,
  history: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks
): Promise<{ response: string; sources: Array<{ title: string; url: string }>; actions: unknown[] }> {
  const response = await authFetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      message,
      context,
      history,
      stream: true,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch chat response')
  }

  // Check if response is SSE
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('text/event-stream')) {
    let sources: Array<{ title: string; url: string }> = []
    let actions: unknown[] = []

    const enhancedCallbacks: StreamCallbacks = {
      ...callbacks,
      onSources: (s) => {
        sources = s
        callbacks.onSources?.(s)
      },
    }

    const fullText = await consumeStream(response, enhancedCallbacks)

    // Parse the response to extract message and actions
    const parsed = parseAIResponseFull(fullText)
    actions = parsed.actions as unknown[]

    return { response: parsed.message, sources, actions }
  }

  // Fallback to JSON response
  const data = await response.json()
  callbacks.onDone?.(data.response)
  return data
}

/**
 * Helper to stream subtask suggestions
 */
export async function streamSubtasks(
  title: string,
  description: string | undefined,
  notes: string | undefined,
  existingSubtasks: string[],
  callbacks: StreamCallbacks
): Promise<{ subtasks: unknown[]; sources: Array<{ title: string; url: string }> }> {
  const response = await authFetch('/api/suggest-subtasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      title,
      description,
      notes,
      existingSubtasks,
      stream: true,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch subtasks')
  }

  // Check if response is SSE
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('text/event-stream')) {
    let sources: Array<{ title: string; url: string }> = []

    const enhancedCallbacks: StreamCallbacks = {
      ...callbacks,
      onSources: (s) => {
        sources = s
        callbacks.onSources?.(s)
      },
    }

    const fullText = await consumeStream(response, enhancedCallbacks)

    // Parse subtasks from the response
    try {
      const jsonMatch = fullText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const subtasks = JSON.parse(jsonMatch[0])
        return { subtasks, sources }
      }
    } catch {
      // Fall through to return empty
    }

    return { subtasks: [], sources }
  }

  // Fallback to JSON response
  const data = await response.json()
  callbacks.onDone?.(JSON.stringify(data.subtasks))
  return data
}
