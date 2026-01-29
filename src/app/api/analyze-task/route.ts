import { NextRequest, NextResponse } from 'next/server'
import { AI_MODELS } from '@/config/ai'
import { requireAuth } from '@/lib/api-auth'
import {
  checkRateLimitAsync,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rateLimit'
import {
  buildTaskAnalysisPrompt,
  TaskAnalysisResponseSchema,
  DEFAULT_TASK_ANALYSIS,
  parseAIResponse,
  extractJSON,
  type TaskAnalysisResponse,
} from '@/lib/ai'

export async function POST(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request)
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
    const { title } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const now = new Date()
    // Use centralized prompt builder from @/lib/ai
    const prompt = buildTaskAnalysisPrompt(title, now)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.taskAnalysis,
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    const data = await response.json()

    if (!data.content || !data.content[0]) {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    const text = data.content[0].text

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse response' }, { status: 500 })
    }

    const analysis = JSON.parse(jsonMatch[0])
    return NextResponse.json(analysis)
  } catch (error) {
    // Error handled silently('Error analyzing task:', error)
    return NextResponse.json({ error: 'Failed to analyze task' }, { status: 500 })
  }
}
