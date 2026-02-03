import { NextRequest, NextResponse } from 'next/server'
import { AI_MODELS, AI_MAX_TOKENS } from '@/config/ai'
import { requireAuthOrDemo, type DemoResult } from '@/lib/api-auth'
import {
  checkRateLimitAsync,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rateLimit'
import {
  buildIntentAnalysisPrompt,
  IntentAnalysisResponseSchema,
  DEFAULT_INTENT_RESPONSE,
  parseAIResponse,
  extractJSON,
  type IntentAnalysisResponse,
} from '@/lib/ai'

/**
 * General-purpose task analysis endpoint
 * Uses a comprehensive prompt to understand ANY task and gather needed context
 * Incorporates memory of past interactions
 * Supports demo mode with stricter rate limits
 */

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
    const { message, memory = [] } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Error handled silently('[analyze-intent] No ANTHROPIC_API_KEY configured')
      return NextResponse.json(
        { error: 'AI service not configured', details: 'Missing ANTHROPIC_API_KEY' },
        { status: 503 }
      )
    }

    // Build conversation with memory
    // Note: Claude Messages API uses 'system' as top-level param, not as a message role
    const userMessages = [
      ...memory.filter((m: { role: string }) => m.role !== 'system').map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: 'user',
        content: `New task: "${message}"\n\nAnalyze this and either ask clarifying questions OR provide steps if you have enough context.`,
      },
    ]

    // Use centralized prompt builder from @/lib/ai
    const systemPrompt = buildIntentAnalysisPrompt(new Date())

    // Log full prompt for debugging
    // Debug log removed('[analyze-intent] Full prompt being sent to Claude:')
    // Debug log removed('System:', systemPrompt.slice(0, 200) + '...')
    // Debug log removed('Messages:', JSON.stringify(userMessages, null, 2))

    // Debug log removed('[analyze-intent] Sending request to Claude API...')
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.intentAnalysis,
        max_tokens: AI_MAX_TOKENS.intentAnalysis,
        system: systemPrompt,
        messages: userMessages,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Error handled silently('[analyze-intent] Claude API error:', response.status, errorText)

      if (response.status === 529 || errorText.includes('overloaded_error')) {
        return NextResponse.json({
          taskName: message,
          understanding: "Sorry — the AI is a bit overloaded right now.",
          needsMoreInfo: true,
          reasoning: "The AI service is temporarily busy, so I can't generate steps yet.",
          questions: [
            {
              question: "Want me to add this as a simple task for now, or try again?",
              key: "ai_overloaded_action",
              options: ["Try again", "Add task without steps"],
            },
          ],
          ifComplete: { steps: [], contextSummary: '' },
        })
      }

      // Return error - let frontend handle it
      return NextResponse.json(
        { error: 'AI service unavailable', status: response.status, details: errorText },
        { status: 503 }
      )
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''

    // Debug log removed('[analyze-intent] Claude raw response:', content)

    // Try to extract and parse JSON
    try {
      // Remove markdown code blocks if present
      let jsonText = content
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1]
      }

      // Find JSON object - use a more precise match
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const rawJson = jsonMatch[0]
        try {
          const parsed = JSON.parse(rawJson)
          // Debug log removed('[analyze-intent] Parsed response:', parsed)
          return NextResponse.json(parsed)
        } catch (parseError) {
          const repaired = rawJson.replace(
            /"([^"]+)"\s*:\s*"([^"]*)"\s*\n\s*"([^"]+)"\s*:/g,
            '"$1": "$2",\n  "$3":'
          )
          try {
            const parsed = JSON.parse(repaired)
            // Debug log removed('[analyze-intent] Parsed response after repair:', parsed)
            return NextResponse.json(parsed)
          } catch (repairError) {
            // Error handled silently('[analyze-intent] JSON parse error:', parseError)
            // Error handled silently('[analyze-intent] JSON repair failed:', repairError)
          }
        }
      }
    } catch (parseError) {
      // Error handled silently('[analyze-intent] JSON parse error:', parseError)
    }

    // If JSON parsing fails, return the raw content for debugging
    return NextResponse.json(
      { error: 'Invalid response from AI', rawContent: content },
      { status: 500 }
    )
  } catch (error) {
    // Error handled silently('Error in analyze-intent:', error)
    return NextResponse.json(
      { error: 'Failed to analyze intent' },
      { status: 500 }
    )
  }
}
