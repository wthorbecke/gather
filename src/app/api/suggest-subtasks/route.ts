import { NextRequest, NextResponse } from 'next/server'
import { splitStepText } from '@/lib/stepText'
import { prioritizeSources, scoreSource, isLowQualitySource, isNewsSource } from '@/lib/sourceQuality'
import { normalizeActionUrl } from '@/config/content'
import { AI_MODELS } from '@/config/ai'
import {
  checkRateLimitAsync,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rateLimit'
import {
  validateTaskInput,
  validationErrorResponse,
} from '@/lib/validation'
import { requireAuthOrDemo, type DemoResult } from '@/lib/api-auth'
import {
  TASK_BREAKDOWN_SYSTEM_PROMPT,
  TaskBreakdownResponseSchema,
  getDefaultSteps,
  parseAIResponse,
  extractJSON,
  type RichStep,
} from '@/lib/ai'

interface ClarifyingAnswer {
  question: string
  answer: string
}

interface SearchSource {
  title: string
  url: string
}

interface SearchResult {
  text: string
  sources: SearchSource[]
}

// Search the web using Tavily - returns formatted text AND extracted sources
async function searchWeb(query: string): Promise<SearchResult> {
  const tavilyKey = process.env.TAVILY_API_KEY
  if (!tavilyKey) {
    return { text: 'Web search not available', sources: [] }
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
      }),
    })

    if (!response.ok) {
      return { text: 'Search failed', sources: [] }
    }

    const data = await response.json()
    const sources: SearchSource[] = []

    // Format results for Claude
    let results = ''
    if (data.answer) {
      results += `Summary: ${data.answer}\n\n`
    }
    if (data.results) {
      const rankedResults = [...data.results].sort((a, b) => scoreSource(b.url) - scoreSource(a.url))
      const rankedSources = prioritizeSources(
        rankedResults.map((r) => ({ title: r.title, url: r.url }))
      )
      const allowedUrls = new Set(rankedSources.map((s) => s.url))
      const filteredResults = rankedResults.filter((r) => allowedUrls.has(r.url)).slice(0, 5)

      results += 'Sources:\n'
      for (const r of filteredResults) {
        // Extract domain name for cleaner source display
        let sourceName = r.title
        try {
          const url = new URL(r.url)
          // Use domain as source name if title is too long
          if (r.title.length > 50) {
            sourceName = url.hostname.replace('www.', '')
          }
        } catch { /* keep original title */ }

        sources.push({ title: sourceName, url: r.url })
        results += `- ${r.title}: ${r.url}\n  ${r.content?.slice(0, 200)}...\n`
      }
    }
    return { text: results || 'No results found', sources }
  } catch (error) {
    // Error handled silently('Tavily search error:', error)
    return { text: 'Search failed', sources: [] }
  }
}

// Use centralized fallback steps from @/lib/ai
const generateFallbackSteps = getDefaultSteps

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

  // Demo users get fewer requests per hour (task breakdown is expensive)
  const rateLimit = isDemo ? { maxRequests: 5, windowMs: 60 * 60 * 1000 } : RATE_LIMITS.aiTaskBreakdown
  const rateCheck = await checkRateLimitAsync(identifier, rateLimit)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck)
  }

  try {
    const body = await request.json()

    // Input validation
    const validation = validateTaskInput(body)
    if (!validation.valid) {
      return validationErrorResponse(validation)
    }

    const { title, description, notes, existingSubtasks, clarifyingAnswers, taskCategory, stream = false } = body

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const existingContext = existingSubtasks?.length > 0
      ? '\n\nAlready added steps:\n' + existingSubtasks.map((s: string) => '- ' + s).join('\n')
      : ''

    // Build context from clarifying answers
    const clarifyingContext = clarifyingAnswers?.length > 0
      ? '\n\nContext from user:\n' + clarifyingAnswers.map((qa: ClarifyingAnswer) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : ''

    // Use centralized system prompt from @/lib/ai
    const systemPrompt = TASK_BREAKDOWN_SYSTEM_PROMPT

    const userPrompt = `Task: ${title}
${description ? 'Description: ' + description : ''}
${notes ? 'Notes: ' + notes : ''}${clarifyingContext}${existingContext}

Return a JSON array of 3-6 specific, actionable steps. Include text, summary, and any relevant details. ONLY output the JSON array, nothing else.`

    // Define the search tool
    const tools = [
      {
        name: 'web_search',
        description: 'Search the web for current information. Use this to find official requirements, URLs, forms, costs, and processes.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query. Be specific, e.g., "California REAL ID requirements 2024" or "California DMV appointment scheduling"',
            },
          },
          required: ['query'],
        },
      },
    ]

    // Process and normalize rich steps
    const processSteps = (parsed: (string | RichStep)[], prioritizedSources: SearchSource[]): RichStep[] => {
      const splitVerboseTitle = (step: RichStep): RichStep => {
        const { title: stepTitle, remainder } = splitStepText(step.text)
        if (!remainder || !stepTitle || stepTitle === step.text) return step
        if (step.summary) {
          return {
            ...step,
            text: stepTitle,
            detail: step.detail ? `${step.detail} ${remainder}` : remainder,
          }
        }
        return {
          ...step,
          text: stepTitle,
          summary: remainder,
        }
      }

      return parsed.map((item: string | RichStep) => {
        if (typeof item === 'string') {
          item = { text: item }
        }
        item = splitVerboseTitle(item)
        // Remove low-quality or news sources
        if (item.source?.url && (isLowQualitySource(item.source.url) || isNewsSource(item.source.url))) {
          item = { ...item, source: undefined }
        }
        // If action is a direct file (e.g., PDF) and source matches it, prefer a broader info source
        if (item.action?.url && item.source?.url) {
          const actionUrl = item.action.url
          const sourceUrl = item.source.url
          const isDirectFile = /\.(pdf|docx?|xlsx?|pptx?)($|[?#])/i.test(actionUrl)
          if (isDirectFile && actionUrl === sourceUrl && prioritizedSources.length > 0) {
            const alternative = prioritizedSources.find((s) => s.url !== actionUrl)
            if (alternative) {
              item = {
                ...item,
                source: { name: alternative.title, url: alternative.url },
              }
            }
          }
        }
        // Normalize known DMV REAL ID application links
        if (item.action?.url && item.action?.text) {
          const actionUrl = item.action.url
          const actionText = item.action.text
          item = {
            ...item,
            action: {
              text: actionText,
              url: normalizeActionUrl(actionUrl),
            },
          }
        }
        return item
      })
    }

    // Handle streaming response
    if (stream) {
      const encoder = new TextEncoder()

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            const collectedSources: SearchSource[] = []
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
                model: AI_MODELS.taskBreakdown,
                max_tokens: 1500,
                stream: true,
                system: systemPrompt,
                tools,
                messages: [{ role: 'user', content: userPrompt }],
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
            let currentToolUse: { id: string; name: string; inputJson: string } | null = null
            const accumulatedContent: Array<{ type: string; [key: string]: unknown }> = []
            const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

            const processStream = async (streamReader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> => {
              while (true) {
                const { done, value } = await streamReader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue

                  const eventData = line.slice(6)
                  if (eventData === '[DONE]') continue

                  try {
                    const event = JSON.parse(eventData)

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
                        // Handle tool use if needed
                        if (event.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
                          // Process tool calls
                          const toolResults = []
                          for (const tool of toolUseBlocks) {
                            if (tool.name === 'web_search') {
                              const searchResult = await searchWeb(tool.input.query as string)
                              collectedSources.push(...searchResult.sources)
                              toolResults.push({
                                type: 'tool_result',
                                tool_use_id: tool.id,
                                content: searchResult.text,
                              })
                            }
                          }

                          // Continue the conversation
                          const continueMessages = [
                            { role: 'user', content: userPrompt },
                            { role: 'assistant', content: accumulatedContent },
                            { role: 'user', content: toolResults },
                          ]

                          const continueResponse = await fetch('https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'x-api-key': apiKey,
                              'anthropic-version': '2023-06-01',
                            },
                            body: JSON.stringify({
                              model: AI_MODELS.taskBreakdown,
                              max_tokens: 1500,
                              stream: true,
                              system: systemPrompt,
                              tools,
                              messages: continueMessages,
                            }),
                          })

                          if (continueResponse.ok) {
                            const continueReader = continueResponse.body?.getReader()
                            if (continueReader) {
                              fullText = '' // Reset for continuation
                              toolUseBlocks.length = 0
                              accumulatedContent.length = 0
                              await processStream(continueReader)
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
            }

            await processStream(reader)

            // Parse the JSON array from the response
            let jsonText = fullText

            // Remove markdown code blocks if present
            const codeBlockMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (codeBlockMatch) {
              jsonText = codeBlockMatch[1]
            }

            // Find JSON array
            const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
            let subtasks: RichStep[]

            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0])
                const prioritizedSources = prioritizeSources(collectedSources)
                subtasks = processSteps(parsed, prioritizedSources)

                // Send sources
                if (prioritizedSources.length > 0) {
                  controller.enqueue(
                    encoder.encode(`event: sources\ndata: ${JSON.stringify({ sources: prioritizedSources })}\n\n`)
                  )
                }

                // Send done event
                controller.enqueue(
                  encoder.encode(
                    `event: done\ndata: ${JSON.stringify({ subtasks, sources: prioritizedSources })}\n\n`
                  )
                )
              } catch {
                // Fall back to fallback steps
                subtasks = generateFallbackSteps(title)
                controller.enqueue(
                  encoder.encode(
                    `event: done\ndata: ${JSON.stringify({ subtasks, sources: [] })}\n\n`
                  )
                )
              }
            } else {
              // Fall back to fallback steps
              subtasks = generateFallbackSteps(title)
              controller.enqueue(
                encoder.encode(
                  `event: done\ndata: ${JSON.stringify({ subtasks, sources: [] })}\n\n`
                )
              )
            }

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
    // First call - Claude may request tool use
    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.taskBreakdown,
        max_tokens: 1500,
        system: systemPrompt,
        tools,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    let data = await response.json()
    
    // Handle tool use - Claude may want to search
    const messages: Array<{role: string, content: unknown}> = [{ role: 'user', content: userPrompt }]
    const collectedSources: SearchSource[] = []

    while (data.stop_reason === 'tool_use') {
      const assistantContent = data.content
      messages.push({ role: 'assistant', content: assistantContent })

      // Process tool calls
      const toolResults = []
      for (const block of assistantContent) {
        if (block.type === 'tool_use' && block.name === 'web_search') {
          // Debug log removed('Searching:', block.input.query)
          const searchResult = await searchWeb(block.input.query)
          // Collect sources for reference
          collectedSources.push(...searchResult.sources)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: searchResult.text,
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
      
      // Continue the conversation
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: AI_MODELS.taskBreakdown,
          max_tokens: 1500,
          system: systemPrompt,
          tools,
          messages,
        }),
      })
      
      data = await response.json()
    }

    // Extract the final text response
    if (!data.content) {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    // Find the text block in the response
    const textBlock = data.content.find((block: {type: string}) => block.type === 'text')
    if (!textBlock) {
      return NextResponse.json({ error: 'No text response' }, { status: 500 })
    }

    const text = textBlock.text
    // Debug log removed('AI response text:', text.substring(0, 500))

    // Parse the JSON array from the response - handle markdown code blocks
    let jsonText = text

    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1]
    }

    // Find JSON array
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      // Error handled silently('Could not find JSON array in:', jsonText.substring(0, 300))
      return NextResponse.json({ subtasks: generateFallbackSteps(title) })
    }

    let parsed
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      // Error handled silently('JSON parse error:', parseError, 'Text:', jsonMatch[0].substring(0, 200))
      return NextResponse.json({ subtasks: generateFallbackSteps(title) })
    }

    const prioritizedSources = prioritizeSources(collectedSources)

    // Normalize to rich step format - handle both string[] and RichStep[]
    const splitVerboseTitle = (step: RichStep): RichStep => {
      const { title, remainder } = splitStepText(step.text)
      if (!remainder || !title || title === step.text) return step
      if (step.summary) {
        return {
          ...step,
          text: title,
          detail: step.detail ? `${step.detail} ${remainder}` : remainder,
        }
      }
      return {
        ...step,
        text: title,
        summary: remainder,
      }
    }

    const steps: RichStep[] = parsed.map((item: string | RichStep, index: number) => {
      if (typeof item === 'string') {
        item = { text: item }
      }
      item = splitVerboseTitle(item)
      // Remove low-quality or news sources
      if (item.source?.url && (isLowQualitySource(item.source.url) || isNewsSource(item.source.url))) {
        item = { ...item, source: undefined }
      }
      // Only add collected sources if the step actually references web-searched content
      // Don't auto-assign sources to steps that don't need them (like "text your friends")
      // The AI should include source in its JSON output when appropriate
      // If action is a direct file (e.g., PDF) and source matches it, prefer a broader info source
      if (item.action?.url && item.source?.url) {
        const actionUrl = item.action.url
        const sourceUrl = item.source.url
        const isDirectFile = /\.(pdf|docx?|xlsx?|pptx?)($|[?#])/i.test(actionUrl)
        if (isDirectFile && actionUrl === sourceUrl && prioritizedSources.length > 0) {
          const alternative = prioritizedSources.find((s) => s.url !== actionUrl)
          if (alternative) {
            item = {
              ...item,
              source: { name: alternative.title, url: alternative.url },
            }
          }
        }
      }
      // Normalize known DMV REAL ID application links to the direct application start
      if (item.action?.url && item.action?.text) {
        const actionUrl = item.action.url
        const actionText = item.action.text
        item = {
          ...item,
          action: {
            text: actionText,
            url: normalizeActionUrl(actionUrl),
          },
        }
      }
      return item
    })

    return NextResponse.json({ subtasks: steps, sources: prioritizedSources })
  } catch (error) {
    // Error handled silently('Error generating subtasks:', error)
    return NextResponse.json({ error: 'Failed to generate subtasks' }, { status: 500 })
  }
}
