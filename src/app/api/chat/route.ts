import { NextRequest, NextResponse } from 'next/server'
import { prioritizeSources } from '@/lib/sourceQuality'
import { AI_MODELS, AI_MAX_TOKENS } from '@/config/ai'

interface Source {
  title: string
  url: string
}

export async function POST(request: NextRequest) {
  try {
    const { message, context, history } = await request.json()
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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ],
        system: `You answer questions for someone with ADHD. Be EXTREMELY concise.

RESPONSE FORMAT:
Return ONLY a JSON object like:
{"message":"...","actions":[{"type":"mark_step_done","stepId":"...","label":"..."},{"type":"focus_step","stepId":"...","label":"..."},{"type":"create_task","title":"...","context":"...","label":"..."},{"type":"show_sources","label":"..."}]}

Only include actions if they are clearly relevant to the question and can be executed safely.
If you suggest mark_step_done or focus_step, you MUST use a stepId that exists in the context.
If the user asks for proof or sources, suggest {"type":"show_sources","label":"Show sources"}.

SPECIAL: "I'M STUCK" REQUESTS
When someone says they're stuck on a step:
1. Acknowledge it briefly (no shame)
2. Pick ONE of these approaches based on what they need:
   - If they need info: search and give the specific answer (URL, phone, requirement)
   - If they need confidence: tell them exactly what to say/do first
   - If it seems too big: suggest breaking it into a smaller piece
   - If they've been stuck awhile: suggest skipping it and coming back
3. End with a simple action they can take in the next 2 minutes
4. ALWAYS include an action button if relevant (mark done, skip to next, etc.)

Example stuck response:
{"message":"For the DMV appointment, call 1-800-777-0133 and say 'I need to schedule a license renewal.' They'll ask for your DL number. That's it.","actions":[{"type":"mark_step_done","stepId":"step-123","label":"Done - I called"}]}

RULES:
- Answer in 1-3 sentences max
- No headers, bullet points, or markdown formatting
- No "let me search" or "based on my research" - just answer
- No disclaimers or caveats
- Use the web_search tool for any factual, procedural, or requirement-based answer
- Prefer official sources (.gov/.mil/.edu) and avoid news, forums, or aggregators for requirements/fees/deadlines
- If no official source is available, say "No official source found" in one short sentence
- If you don't know, say "I don't know" in 5 words or less
- If the context includes a specific task or step and the question is unrelated, say: "That seems unrelated to this task. What do you need help with for it?"

Be direct. Be brief. Answer the question.`,
        messages,
      }),
    })

    let data = await response.json()
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
          system: `You answer questions for someone with ADHD. Be EXTREMELY concise.

RESPONSE FORMAT:
Return ONLY a JSON object like:
{"message":"...","actions":[{"type":"mark_step_done","stepId":"...","label":"..."},{"type":"focus_step","stepId":"...","label":"..."},{"type":"create_task","title":"...","context":"...","label":"..."},{"type":"show_sources","label":"..."}]}

Only include actions if they are clearly relevant to the question and can be executed safely.
If you suggest mark_step_done or focus_step, you MUST use a stepId that exists in the context.
If the user asks for proof or sources, suggest {"type":"show_sources","label":"Show sources"}.

RULES:
- Answer in 1-3 sentences max
- No headers, bullet points, or markdown formatting
- No "let me search" or "based on my research" - just answer
- No disclaimers or caveats
- Use the web_search tool for any factual, procedural, or requirement-based answer
- Prefer official sources (.gov/.mil/.edu) and avoid news, forums, or aggregators for requirements/fees/deadlines
- If no official source is available, say "No official source found" in one short sentence
- If the context includes a specific task or step and the question is unrelated, say: "That seems unrelated to this task. What do you need help with for it?"

Be direct. Be brief. Answer the question.`,
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
      console.error('Chat API error:', data.error)
      return NextResponse.json({
        response: `Error: ${data.error.message || 'Unknown error'}`,
        sources: []
      })
    }

    const topSources = prioritizeSources(sources).slice(0, 3)
    let parsedMessage = responseText
    let actions: Array<Record<string, unknown>> = []
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (typeof parsed.message === 'string') {
          parsedMessage = parsed.message
        }
        if (Array.isArray(parsed.actions)) {
          actions = parsed.actions
        }
      }
    } catch (parseError) {
      // Fall back to raw text if JSON parsing fails
    }

    return NextResponse.json({
      response: parsedMessage || 'Sorry, I couldn\'t generate a response.',
      sources: topSources,
      actions,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
