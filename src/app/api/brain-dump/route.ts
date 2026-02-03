import { NextRequest, NextResponse } from 'next/server'
import { AI_MODELS } from '@/config/ai'
import {
  checkRateLimitAsync,
  getRequestIdentifier,
  rateLimitResponse,
} from '@/lib/rateLimit'
import { requireAuthOrDemo } from '@/lib/api-auth'
import { checkSubscriptionTier, getTierRateLimit } from '@/lib/subscription'

// Brain dump extraction system prompt
const BRAIN_DUMP_SYSTEM_PROMPT = `You are a helpful assistant that extracts actionable tasks from freeform text.

The user has done a "brain dump" - they've written out everything on their mind without structure.
Your job is to:
1. Extract discrete, actionable items from the text
2. Group related items together
3. Suggest clear task titles
4. Optionally suggest a first step for complex tasks

IMPORTANT RULES:
- Keep task titles concise (under 50 characters ideally)
- Don't add tasks that weren't mentioned or implied
- If something is vague, keep it vague in the title
- Group truly related items, don't force groupings
- Each task should be something that could be checked off

Return a JSON object with this structure:
{
  "tasks": [
    {
      "title": "Clear task title",
      "firstStep": "Optional first concrete step",
      "originalText": "The part of the text this came from",
      "group": "Optional group name if related to other tasks"
    }
  ],
  "groups": ["Group 1", "Group 2"]
}

ONLY output the JSON, nothing else.`

export async function POST(request: NextRequest) {
  // Require authentication OR demo mode
  const auth = await requireAuthOrDemo(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  // Check subscription tier for rate limiting
  const isDemo = 'isDemo' in auth && auth.isDemo
  const subscriptionCheck = await checkSubscriptionTier(auth.userId, isDemo)

  // Build rate limit identifier
  const identifier = isDemo
    ? `demo:${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'}`
    : getRequestIdentifier(request, auth.userId)

  // Apply tier-based rate limits (using same limits as AI breakdown)
  const rateLimit = getTierRateLimit(subscriptionCheck.tier, 'aiBreakdown')
  const rateCheck = await checkRateLimitAsync(identifier, rateLimit)
  if (!rateCheck.allowed) {
    if (subscriptionCheck.tier === 'free') {
      return NextResponse.json({
        error: 'Daily limit reached',
        message: 'Upgrade to Pro for unlimited AI features',
        upgradeRequired: true,
      }, { status: 429 })
    }
    return rateLimitResponse(rateCheck)
  }

  try {
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (text.length > 10000) {
      return NextResponse.json({ error: 'Text too long (max 10000 characters)' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Make request to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.taskBreakdown,
        max_tokens: 2000,
        system: BRAIN_DUMP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Extract tasks from this brain dump:\n\n${text}` }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', errorText)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }

    const data = await response.json()

    // Extract the text response
    const textBlock = data.content?.find((block: { type: string }) => block.type === 'text')
    if (!textBlock) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    const responseText = textBlock.text

    // Parse JSON from response
    let jsonText = responseText

    // Remove markdown code blocks if present
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1]
    }

    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        tasks: [],
        groups: [],
        error: 'Could not parse AI response'
      })
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json({
        tasks: parsed.tasks || [],
        groups: parsed.groups || [],
      })
    } catch {
      return NextResponse.json({
        tasks: [],
        groups: [],
        error: 'Invalid JSON in AI response'
      })
    }
  } catch (error) {
    console.error('Brain dump error:', error)
    return NextResponse.json({ error: 'Failed to process brain dump' }, { status: 500 })
  }
}
