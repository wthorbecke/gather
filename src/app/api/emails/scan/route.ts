import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken } from '@/lib/google-auth'

// Task-like patterns in email subjects
const TASK_PATTERNS = [
  /action required/i,
  /action needed/i,
  /please review/i,
  /please sign/i,
  /deadline/i,
  /due date/i,
  /expires/i,
  /expiring/i,
  /appointment confirmed/i,
  /appointment scheduled/i,
  /your .* is ready/i,
  /reminder:/i,
  /don't forget/i,
  /follow up/i,
  /waiting for your/i,
  /requires your/i,
  /needs your/i,
  /payment due/i,
  /invoice/i,
  /renewal/i,
  /verify your/i,
  /confirm your/i,
  /schedule your/i,
  /time.sensitive/i,
  /urgent/i,
  /respond by/i,
]

interface GmailMessage {
  id: string
  threadId: string
}

interface GmailMessageDetail {
  id: string
  payload: {
    headers: Array<{ name: string; value: string }>
  }
  snippet: string
  internalDate: string
}

interface PotentialTask {
  id: string
  subject: string
  from: string
  snippet: string
  date: string
  matchedPattern: string
  aiAnalysis?: {
    category: string
    confidence: number
    suggestedTask?: {
      title: string
      dueDate: string | null
      urgency: string
    }
  }
}

function getHeader(message: GmailMessageDetail, headerName: string): string {
  const header = message.payload.headers.find(
    (h) => h.name.toLowerCase() === headerName.toLowerCase()
  )
  return header?.value || ''
}

function extractSenderName(from: string): string {
  // Extract just the name part from "Name <email@example.com>"
  const match = from.match(/^([^<]+)\s*</)
  if (match) {
    return match[1].trim().replace(/"/g, '')
  }
  // If no name, extract domain from email
  const emailMatch = from.match(/@([^.]+)/)
  if (emailMatch) {
    return emailMatch[1].charAt(0).toUpperCase() + emailMatch[1].slice(1)
  }
  return from
}

function matchesTaskPattern(subject: string): string | null {
  for (const pattern of TASK_PATTERNS) {
    if (pattern.test(subject)) {
      // Return a readable version of the matched pattern
      const match = subject.match(pattern)
      return match ? match[0] : pattern.source
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)

    // Create Supabase client to verify session and get provider token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Try to get stored token first (for background/refresh token support)
    let gmailToken = await getValidToken(user.id)

    // Fall back to session provider token
    if (!gmailToken) {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.provider_token) {
        return NextResponse.json({
          error: 'Gmail not connected',
          needsReauth: true,
          message: 'Please sign in again to connect Gmail'
        }, { status: 401 })
      }
      gmailToken = session.provider_token
    }

    // Fetch recent emails from Gmail API
    const listResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?' +
      new URLSearchParams({
        maxResults: '30',
        q: 'is:unread newer_than:7d',
      }),
      {
        headers: {
          Authorization: `Bearer ${gmailToken}`,
        },
      }
    )

    if (!listResponse.ok) {
      const errorText = await listResponse.text()
      console.error('Gmail API error:', listResponse.status, errorText)

      if (listResponse.status === 401) {
        return NextResponse.json({
          error: 'Gmail token expired',
          needsReauth: true,
          message: 'Please sign in again to reconnect Gmail'
        }, { status: 401 })
      }

      return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
    }

    const listData = await listResponse.json()
    const messages: GmailMessage[] = listData.messages || []

    if (messages.length === 0) {
      return NextResponse.json({ potentialTasks: [], message: 'No unread emails found' })
    }

    // Fetch message details in batches
    const potentialTasks: PotentialTask[] = []

    for (const msg of messages.slice(0, 20)) {
      try {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${gmailToken}`,
            },
          }
        )

        if (!detailResponse.ok) continue

        const detail: GmailMessageDetail = await detailResponse.json()
        const subject = getHeader(detail, 'Subject')
        const from = getHeader(detail, 'From')
        const date = getHeader(detail, 'Date')

        const matchedPattern = matchesTaskPattern(subject)
        if (matchedPattern) {
          potentialTasks.push({
            id: msg.id,
            subject,
            from: extractSenderName(from),
            snippet: detail.snippet,
            date: new Date(date).toLocaleDateString(),
            matchedPattern,
          })
        }
      } catch (err) {
        console.error('Error fetching message detail:', err)
      }
    }

    return NextResponse.json({
      potentialTasks,
      scannedCount: messages.length,
      message: potentialTasks.length > 0
        ? `Found ${potentialTasks.length} emails that might be tasks`
        : 'No task-like emails found'
    })

  } catch (error) {
    console.error('Error scanning emails:', error)
    return NextResponse.json({ error: 'Failed to scan emails' }, { status: 500 })
  }
}
