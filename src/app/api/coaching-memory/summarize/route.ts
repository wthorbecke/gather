import { NextRequest, NextResponse } from 'next/server'
import { AI_MODELS, AI_MAX_TOKENS } from '@/config/ai'
import { requireAuthOrDemo } from '@/lib/api-auth'
import {
  checkRateLimitAsync,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rateLimit'

/**
 * Summarize a conversation for long-term coaching memory
 * Extracts: key insights, strategies used, emotional state, follow-up needs
 */

const SUMMARIZE_PROMPT = `You are analyzing a conversation to extract coaching insights for someone with ADHD. Your goal is to capture what was learned that could help in future conversations.

Analyze this conversation and extract:
1. Key topics discussed
2. Any strategies suggested or discovered
3. The user's emotional state throughout
4. Any patterns observed (task avoidance, time management, energy levels, etc.)
5. What follow-up might be helpful

Return ONLY valid JSON:
{
  "topics": ["topic1", "topic2"],
  "keyInsights": ["insight1", "insight2"],
  "strategiesUsed": [
    {
      "trigger": "what situation triggered needing help",
      "strategy": "what helped or was suggested",
      "wasEffective": true/false/null
    }
  ],
  "emotionalState": "overwhelmed" | "stuck" | "motivated" | "energized" | "neutral",
  "patternsObserved": ["pattern1"],
  "followUpNeeded": "what to check on next time" or null
}

Be concise. Each insight should be one sentence max.
Focus on actionable patterns, not conversation details.`

export async function POST(request: NextRequest) {
  // Require authentication OR demo mode
  const auth = await requireAuthOrDemo(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  // Rate limiting
  const isDemo = 'isDemo' in auth && auth.isDemo
  const identifier = isDemo
    ? `demo:${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'}`
    : getRequestIdentifier(request, auth.userId)

  const rateLimit = isDemo
    ? { limit: 20, windowSeconds: 3600, name: 'demo-coaching' as const }
    : RATE_LIMITS.aiChat
  const rateCheck = await checkRateLimitAsync(identifier, rateLimit)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck)
  }

  try {
    const { messages, taskContext } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 messages required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    // Build the conversation text
    const conversationText = messages
      .map((m: { role: string; content: string }) =>
        `${m.role.toUpperCase()}: ${m.content}`
      )
      .join('\n\n')

    const contextNote = taskContext
      ? `\nTask context: "${taskContext.title}"${taskContext.steps ? ` with ${taskContext.steps.length} steps` : ''}`
      : ''

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.intentAnalysis, // Use fast model for summarization
        max_tokens: AI_MAX_TOKENS.intentAnalysis,
        system: SUMMARIZE_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Analyze this conversation:${contextNote}\n\n${conversationText}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'AI service unavailable' },
        { status: 503 }
      )
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''

    // Parse the JSON response
    try {
      let jsonText = content
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1]
      }

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return NextResponse.json(parsed)
      }
    } catch (parseError) {
      console.error('Failed to parse summarization response:', parseError)
    }

    // Return a basic response if parsing fails
    return NextResponse.json({
      topics: [],
      keyInsights: [],
      strategiesUsed: [],
      emotionalState: 'neutral',
      patternsObserved: [],
      followUpNeeded: null,
    })
  } catch (error) {
    console.error('Error in coaching-memory/summarize:', error)
    return NextResponse.json(
      { error: 'Failed to summarize conversation' },
      { status: 500 }
    )
  }
}
