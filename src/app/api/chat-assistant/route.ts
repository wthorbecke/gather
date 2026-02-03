import { NextRequest, NextResponse } from 'next/server'
import { AI_MODELS, AI_TEMPERATURE, AI_MAX_TOKENS } from '@/config/ai'
import {
  checkRateLimitAsync,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rateLimit'
import { requireAuthOrDemo } from '@/lib/api-auth'

const CHAT_ASSISTANT_SYSTEM_PROMPT = `You are a helpful assistant for Gather, a task management app for people who struggle with executive function.

You can:
- Have natural conversations
- Create tasks when the user mentions something they need to do
- Be supportive without being patronizing

Guidelines:
- Keep responses brief (1-3 sentences unless more detail is requested)
- If something sounds like a task, offer to create it — don't assume
- Never guilt trip about incomplete tasks
- Speak like a supportive friend, not a corporate assistant
- Don't use excessive emojis or corporate wellness language

When the user confirms they want to create a task, include this JSON block at the END of your response (after your message):
{"type": "create_task", "title": "clear, actionable task title", "context": "brief summary of why this task was created based on conversation"}

ONLY include the action block when:
1. The user has explicitly confirmed they want to create a task, OR
2. The user directly asks you to create/add a task

Examples of when to include the action block:
- User: "yes, create that task" -> Include action
- User: "add 'call mom' to my list" -> Include action
- User: "yeah let's do it" (after you offered to create) -> Include action

Examples of when NOT to include the action block:
- User mentions something they need to do -> Offer to create, don't create yet
- User is just venting or chatting -> Respond naturally
- User says "maybe" or seems unsure -> Ask for confirmation

Keep the task title concise but clear. The context should capture the why behind the task.`

export async function POST(request: NextRequest) {
  // Require authentication (or demo mode)
  const auth = await requireAuthOrDemo(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  // Rate limiting
  const identifier = getRequestIdentifier(request, auth.userId)
  const rateCheck = await checkRateLimitAsync(identifier, RATE_LIMITS.aiChat)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck)
  }

  try {
    const body = await request.json()
    const { message, history = [], stream = false } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    // Build messages array with history
    const messages: Array<{ role: string; content: string }> = [
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ]

    // Handle streaming response
    if (stream) {
      const encoder = new TextEncoder()

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            let fullText = ''

            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: AI_MODELS.conversation,
                max_tokens: AI_MAX_TOKENS.conversation,
                temperature: AI_TEMPERATURE.conversation,
                stream: true,
                system: CHAT_ASSISTANT_SYSTEM_PROMPT,
                messages,
              }),
            })

            if (!response.ok) {
              const errorText = await response.text()
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: errorText })}\n\n`)
              )
              controller.close()
              return
            }

            const reader = response.body?.getReader()
            if (!reader) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`)
              )
              controller.close()
              return
            }

            const decoder = new TextDecoder()
            let buffer = ''

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
                    case 'content_block_delta':
                      if (event.delta?.type === 'text_delta') {
                        const text = event.delta.text
                        fullText += text
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                        )
                      }
                      break

                    case 'message_stop':
                      // Send done event
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`)
                      )
                      break
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }

            controller.close()
          } catch (error) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Non-streaming response
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.conversation,
        max_tokens: AI_MAX_TOKENS.conversation,
        temperature: AI_TEMPERATURE.conversation,
        system: CHAT_ASSISTANT_SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `AI request failed: ${errorText}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''

    return NextResponse.json({ message: content })
  } catch (error) {
    console.error('[chat-assistant] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
