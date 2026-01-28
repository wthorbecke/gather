import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken } from '@/lib/google-auth'
import { AI_MODEL_FAST } from '@/config/ai'

interface EmailAnalysisResult {
  actionable: boolean
  category: 'BILL_DUE' | 'APPOINTMENT' | 'DEADLINE' | 'REQUEST' | 'NOT_ACTIONABLE'
  confidence: number  // 0-1
  suggestedTask: {
    title: string
    dueDate: string | null
    urgency: 'high' | 'medium' | 'low'
  } | null
  reason: string
}

interface GmailMessageFull {
  id: string
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string }
    parts?: Array<{
      mimeType: string
      body?: { data?: string }
    }>
  }
  internalDate: string
}

const EMAIL_ANALYSIS_PROMPT = `You're helping someone with ADHD identify actionable emails. They get overwhelmed by their inbox, so only flag emails that truly require action.

Analyze this email and determine if it requires action.

Categories of actionable emails:
- BILL_DUE: Payment required (bills, invoices with due dates)
- APPOINTMENT: Scheduled meeting/appointment that needs confirmation or preparation
- DEADLINE: Something expires or is due by a specific date
- REQUEST: Someone specifically asking for a response or action from the user
- NOT_ACTIONABLE: Marketing, newsletters, receipts (no action needed), informational updates, automated notifications

Be conservative - only mark as actionable if the user genuinely needs to do something.

Respond with JSON only (no markdown):
{
  "actionable": boolean,
  "category": "BILL_DUE" | "APPOINTMENT" | "DEADLINE" | "REQUEST" | "NOT_ACTIONABLE",
  "confidence": number between 0 and 1,
  "suggestedTask": {
    "title": "Short, actionable task title",
    "dueDate": "YYYY-MM-DD or null",
    "urgency": "high" | "medium" | "low"
  } or null if not actionable,
  "reason": "Brief explanation of your classification"
}`

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

function decodeBase64(data: string): string {
  try {
    // Gmail uses URL-safe base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function extractEmailBody(message: GmailMessageFull): string {
  // Try to get plain text body
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data)
      }
    }
    // Fall back to HTML if no plain text
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64(part.body.data)
        // Basic HTML stripping
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
  }

  // Simple message body
  if (message.payload.body?.data) {
    return decodeBase64(message.payload.body.data)
  }

  // Fall back to snippet
  return message.snippet
}

/**
 * Analyze an email using AI to determine if it's actionable.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)
    const body = await request.json()
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 })
    }

    // Verify user session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get Google token
    const googleToken = await getValidToken(user.id)
    if (!googleToken) {
      return NextResponse.json({
        error: 'Google not connected',
        needsReauth: true,
      }, { status: 401 })
    }

    // Fetch full email content
    const emailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      }
    )

    if (!emailResponse.ok) {
      console.error('[EmailAnalyze] Failed to fetch email:', emailResponse.status)
      return NextResponse.json({ error: 'Failed to fetch email' }, { status: 500 })
    }

    const email: GmailMessageFull = await emailResponse.json()

    const subject = getHeader(email.payload.headers, 'Subject')
    const from = getHeader(email.payload.headers, 'From')
    const date = getHeader(email.payload.headers, 'Date')
    const body_text = extractEmailBody(email)

    // Truncate body to avoid token limits
    const truncatedBody = body_text.slice(0, 2000)

    // Check if we have Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      // Fall back to regex-based analysis
      return NextResponse.json(fallbackAnalysis(subject, from, truncatedBody))
    }

    // Use Claude for analysis via raw API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL_FAST,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `${EMAIL_ANALYSIS_PROMPT}

Email details:
From: ${from}
Subject: ${subject}
Date: ${date}

Body (truncated):
${truncatedBody}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('[EmailAnalyze] AI request failed:', response.status)
      return NextResponse.json(fallbackAnalysis(subject, from, truncatedBody))
    }

    const data = await response.json()
    const responseText = data.content?.[0]?.text || ''

    try {
      const analysis: EmailAnalysisResult = JSON.parse(responseText)

      return NextResponse.json({
        messageId,
        subject,
        from,
        date,
        analysis,
      })
    } catch (parseError) {
      console.error('[EmailAnalyze] Failed to parse AI response:', responseText)
      return NextResponse.json(fallbackAnalysis(subject, from, truncatedBody))
    }
  } catch (error) {
    console.error('[EmailAnalyze] Error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

/**
 * Fallback regex-based analysis when AI is unavailable.
 */
function fallbackAnalysis(subject: string, from: string, body: string): {
  messageId?: string
  subject: string
  from: string
  analysis: EmailAnalysisResult
} {
  const combinedText = `${subject} ${body}`.toLowerCase()

  // Check for bill/payment patterns
  const billPatterns = [
    /payment due/i,
    /bill due/i,
    /amount due/i,
    /pay by/i,
    /invoice #?\d/i,
    /balance due/i,
  ]

  // Check for deadline patterns
  const deadlinePatterns = [
    /expires? (on|by)?/i,
    /deadline/i,
    /due (date|by)/i,
    /respond by/i,
    /submit by/i,
    /last day/i,
  ]

  // Check for appointment patterns
  const appointmentPatterns = [
    /appointment (confirmed|scheduled|reminder)/i,
    /your .* is scheduled/i,
    /meeting (on|at|scheduled)/i,
    /reservation confirmed/i,
  ]

  // Check for request patterns
  const requestPatterns = [
    /please (review|confirm|sign|respond|approve)/i,
    /action required/i,
    /action needed/i,
    /waiting for your/i,
    /requires your/i,
    /needs your/i,
  ]

  let category: EmailAnalysisResult['category'] = 'NOT_ACTIONABLE'
  let confidence = 0.3
  let suggestedTitle = ''

  if (billPatterns.some(p => p.test(combinedText))) {
    category = 'BILL_DUE'
    confidence = 0.7
    suggestedTitle = `Pay bill: ${subject.slice(0, 50)}`
  } else if (deadlinePatterns.some(p => p.test(combinedText))) {
    category = 'DEADLINE'
    confidence = 0.6
    suggestedTitle = `Deadline: ${subject.slice(0, 50)}`
  } else if (appointmentPatterns.some(p => p.test(combinedText))) {
    category = 'APPOINTMENT'
    confidence = 0.7
    suggestedTitle = `Prepare for: ${subject.slice(0, 50)}`
  } else if (requestPatterns.some(p => p.test(combinedText))) {
    category = 'REQUEST'
    confidence = 0.6
    suggestedTitle = `Respond to: ${subject.slice(0, 50)}`
  }

  const actionable = category !== 'NOT_ACTIONABLE'

  return {
    subject,
    from,
    analysis: {
      actionable,
      category,
      confidence,
      suggestedTask: actionable ? {
        title: suggestedTitle,
        dueDate: null,
        urgency: category === 'BILL_DUE' ? 'high' : 'medium',
      } : null,
      reason: actionable
        ? 'Detected based on keyword patterns (AI analysis unavailable)'
        : 'No actionable patterns detected',
    },
  }
}

/**
 * Batch analyze multiple emails.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)
    const { searchParams } = new URL(request.url)
    const useAI = searchParams.get('ai') !== 'false'

    // Verify user session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get Google token
    const googleToken = await getValidToken(user.id)
    if (!googleToken) {
      return NextResponse.json({
        error: 'Google not connected',
        needsReauth: true,
      }, { status: 401 })
    }

    // Fetch recent emails
    const listResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?' +
      new URLSearchParams({
        maxResults: '20',
        q: 'is:unread newer_than:7d',
      }),
      {
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      }
    )

    if (!listResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
    }

    const listData = await listResponse.json()
    const messages = listData.messages || []

    if (messages.length === 0) {
      return NextResponse.json({ results: [], message: 'No unread emails' })
    }

    // Analyze each email (for now, just return metadata)
    const results = []
    for (const msg of messages.slice(0, 10)) {
      try {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${googleToken}`,
            },
          }
        )

        if (!detailResponse.ok) continue

        const detail = await detailResponse.json()
        const subject = getHeader(detail.payload.headers, 'Subject')
        const from = getHeader(detail.payload.headers, 'From')

        // Use fallback analysis for batch (AI analysis is too slow for batch)
        const analysis = fallbackAnalysis(subject, from, detail.snippet)

        if (analysis.analysis.actionable) {
          results.push({
            messageId: msg.id,
            ...analysis,
          })
        }
      } catch (error) {
        console.error('[EmailAnalyze] Error analyzing message:', msg.id, error)
      }
    }

    return NextResponse.json({
      results,
      scannedCount: messages.length,
      useAI,
    })
  } catch (error) {
    console.error('[EmailAnalyze] Batch error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
