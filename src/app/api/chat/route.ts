import { NextRequest, NextResponse } from 'next/server'
import { prioritizeSources } from '@/lib/sourceQuality'
import { AI_MODELS } from '@/config/ai'
import {
  checkRateLimitAsync,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rateLimit'
import {
  validateChatInput,
  validationErrorResponse,
} from '@/lib/validation'
import { requireAuthOrDemo, type DemoResult } from '@/lib/api-auth'
import {
  CHAT_SYSTEM_PROMPT,
  ChatResponseSchema,
  DEFAULT_CHAT_RESPONSE,
  parseAIResponse,
  extractJSON,
  parseAIResponseFull,
  type ChatResponse,
} from '@/lib/ai'

interface Source {
  title: string
  url: string
}

export async function POST(request: NextRequest) {
  // Require authentication OR demo mode
  const auth = await requireAuthOrDemo(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  // Use stricter rate limits for demo users (by IP)
  const isDemo = 'isDemo' in auth && auth.isDemo
  const identifier = isDemo
    ? `demo:${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'}`
    : getRequestIdentifier(request, auth.userId)

  // Demo users get fewer requests per hour
  const rateLimit = isDemo ? { limit: 10, windowSeconds: 3600, name: 'demo-ai-chat' as const } : RATE_LIMITS.aiChat
  const rateCheck = await checkRateLimitAsync(identifier, rateLimit)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck)
  }

  try {
    const body = await request.json()

    // Input validation
    const validation = validateChatInput(body)
    if (!validation.valid) {
      return validationErrorResponse(validation)
    }

    const { message, context, history, stream = false } = body
    const structuredContext = typeof context === 'object' && context !== null

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    // Build messages array with history
    const messages: Array<{ role: string; content: unknown }> = [
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: structuredContext
          ? `Context (JSON): ${JSON.stringify(context)}

Question: ${message}

Return ONLY JSON.`
          : `Context: ${context}

Question: ${message}

Return ONLY JSON.`,
      },
    ]

    // Handle streaming response
    if (stream) {
      const encoder = new TextEncoder()

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            const sources: Source[] = []
            let fullText = ''

            // Make streaming request to Anthropic
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: AI_MODELS.conversation,
                max_tokens: 512,
                stream: true,
                tools: [
                  {
                    type: 'web_search_20250305',
                    name: 'web_search',
                  },
                ],
                system: CHAT_SYSTEM_PROMPT,
                messages,
              }),
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
            const toolUseBlocks: Array<{
              id: string
              name: string
              input: Record<string, unknown>
            }> = []
            let currentToolUse: { id: string; name: string; inputJson: string } | null = null
            const accumulatedContent: Array<{ type: string; [key: string]: unknown }> = []

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

                  switch (event.type) {
                    case 'content_block_start':
                      if (event.content_block?.type === 'tool_use') {
                        currentToolUse = {
                          id: event.content_block.id,
                          name: event.content_block.name,
                          inputJson: '',
                        }
                      } else if (event.content_block?.type === 'web_search_tool_result') {
                        // Extract sources from web search results
                        if (event.content_block.content) {
                          for (const result of event.content_block.content) {
                            if (result.type === 'web_search_result' && result.url && result.title) {
                              if (!sources.some((s) => s.url === result.url)) {
                                sources.push({ title: result.title, url: result.url })
                              }
                            }
                          }
                        }
                      }
                      break

                    case 'content_block_delta':
                      if (event.delta?.type === 'text_delta') {
                        const text = event.delta.text
                        fullText += text
                        // Send token immediately
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
                          accumulatedContent.push({
                            type: 'tool_use',
                            id: currentToolUse.id,
                            name: currentToolUse.name,
                            input,
                          })
                        } catch {
                          // Invalid JSON, skip
                        }
                        currentToolUse = null
                      } else if (fullText) {
                        accumulatedContent.push({ type: 'text', text: fullText })
                      }
                      break

                    case 'message_stop':
                      // Check if we need to continue due to tool use
                      if (event.stop_reason === 'tool_use' || toolUseBlocks.length > 0) {
                        // Continue conversation with tool results
                        const continueMessages = [
                          ...messages,
                          { role: 'assistant', content: accumulatedContent },
                        ]

                        const continueResponse = await fetch(
                          'https://api.anthropic.com/v1/messages',
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'x-api-key': apiKey,
                              'anthropic-version': '2023-06-01',
                            },
                            body: JSON.stringify({
                              model: AI_MODELS.conversation,
                              max_tokens: 512,
                              stream: true,
                              tools: [
                                {
                                  type: 'web_search_20250305',
                                  name: 'web_search',
                                },
                              ],
                              system: CHAT_SYSTEM_PROMPT,
                              messages: continueMessages,
                            }),
                          }
                        )

                        if (continueResponse.ok) {
                          const continueReader = continueResponse.body?.getReader()
                          if (continueReader) {
                            let continueBuffer = ''
                            fullText = '' // Reset for continuation

                            while (true) {
                              const { done: contDone, value: contValue } =
                                await continueReader.read()
                              if (contDone) break

                              continueBuffer += decoder.decode(contValue, { stream: true })
                              const contLines = continueBuffer.split('\n')
                              continueBuffer = contLines.pop() || ''

                              for (const contLine of contLines) {
                                if (!contLine.startsWith('data: ')) continue
                                const contData = contLine.slice(6)
                                if (contData === '[DONE]') continue

                                try {
                                  const contEvent = JSON.parse(contData)
                                  if (
                                    contEvent.type === 'content_block_delta' &&
                                    contEvent.delta?.type === 'text_delta'
                                  ) {
                                    const text = contEvent.delta.text
                                    fullText += text
                                    controller.enqueue(
                                      encoder.encode(
                                        `event: token\ndata: ${JSON.stringify({ text })}\n\n`
                                      )
                                    )
                                  } else if (
                                    contEvent.type === 'content_block_start' &&
                                    contEvent.content_block?.type === 'web_search_tool_result'
                                  ) {
                                    // Extract more sources
                                    if (contEvent.content_block.content) {
                                      for (const result of contEvent.content_block.content) {
                                        if (
                                          result.type === 'web_search_result' &&
                                          result.url &&
                                          result.title
                                        ) {
                                          if (!sources.some((s) => s.url === result.url)) {
                                            sources.push({ title: result.title, url: result.url })
                                          }
                                        }
                                      }
                                    }
                                  }
                                } catch {
                                  // Skip malformed JSON
                                }
                              }
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

            // Parse the response to extract message and actions
            const topSources = prioritizeSources(sources).slice(0, 3)
            const parsedResponse = parseAIResponseFull(fullText)
            const parsedMessage = parsedResponse.message
            const actions = parsedResponse.actions

            // Send sources
            if (topSources.length > 0) {
              controller.enqueue(
                encoder.encode(`event: sources\ndata: ${JSON.stringify({ sources: topSources })}\n\n`)
              )
            }

            // Send done event with parsed response
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  response: parsedMessage || "Sorry, I couldn't generate a response.",
                  sources: topSources,
                  actions,
                })}\n\n`
              )
            )
            controller.close()
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  message: error instanceof Error ? error.message : 'Unknown error',
                })}\n\n`
              )
            )
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Non-streaming response (existing code path)
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.conversation,
        max_tokens: 512,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ],
        system: CHAT_SYSTEM_PROMPT,
        messages,
      }),
    })

    let data = await aiResponse.json()
    const sources: Source[] = []

    // Handle agentic loop - Claude may search multiple times
    while (data.stop_reason === 'tool_use') {
      // Extract any sources from web_search_tool_result blocks
      if (data.content) {
        for (const block of data.content) {
          if (block.type === 'web_search_tool_result' && block.content) {
            for (const result of block.content) {
              if (result.type === 'web_search_result' && result.url && result.title) {
                sources.push({ title: result.title, url: result.url })
              }
            }
          }
        }
      }

      // Add assistant response to messages
      messages.push({ role: 'assistant', content: data.content })

      // Continue the conversation
      const continueResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: AI_MODELS.conversation,
          max_tokens: 512,
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
            },
          ],
          system: CHAT_SYSTEM_PROMPT,
          messages,
        }),
      })

      data = await continueResponse.json()
    }

    // Extract final text response and any remaining sources
    let responseText = ''
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') {
          responseText += block.text
        }
        // Also check for sources in final response
        if (block.type === 'web_search_tool_result' && block.content) {
          for (const result of block.content) {
            if (result.type === 'web_search_result' && result.url && result.title) {
              // Avoid duplicates
              if (!sources.some(s => s.url === result.url)) {
                sources.push({ title: result.title, url: result.url })
              }
            }
          }
        }
      }
    }

    if (!responseText && data.error) {
      return NextResponse.json({
        response: `Error: ${data.error.message || 'Unknown error'}`,
        sources: []
      })
    }

    const topSources = prioritizeSources(sources).slice(0, 3)
    const parsedResponse = parseAIResponseFull(responseText)
    const parsedMessage = parsedResponse.message
    const actions = parsedResponse.actions

    // No caching for AI responses - they should be fresh
    const response = NextResponse.json({
      response: parsedMessage || 'Sorry, I couldn\'t generate a response.',
      sources: topSources,
      actions,
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch {
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
