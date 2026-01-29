import { NextRequest, NextResponse } from 'next/server'
import { AI_MODELS, AI_MAX_TOKENS } from '@/config/ai'
import { verifyCronAuth } from '@/lib/api-auth'
import { HEALTH_CHECK_PROMPT } from '@/lib/ai'

/**
 * Test endpoint for AI connectivity.
 * Protected by CRON_SECRET in production, open in development.
 */
export async function GET(request: NextRequest) {
  // In production, require CRON_SECRET (for health checks)
  // In development, allow open access for testing
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && !verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 500 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.healthCheck,
        max_tokens: AI_MAX_TOKENS.healthCheck,
        messages: [{ role: 'user', content: HEALTH_CHECK_PROMPT }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({
        error: 'API request failed',
        status: response.status,
        details: error
      }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json({
      success: true,
      response: data.content?.[0]?.text
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Exception occurred',
      details: String(error)
    }, { status: 500 })
  }
}
