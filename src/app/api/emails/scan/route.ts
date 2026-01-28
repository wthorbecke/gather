import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken } from '@/lib/google-auth'

// Task-like patterns in email subjects and snippets
const TASK_PATTERNS = [
  // Action required
  /action required/i,
  /action needed/i,
  /response required/i,
  /response needed/i,
  /your response/i,
  /please respond/i,
  /please reply/i,
  /please review/i,
  /please confirm/i,
  /please sign/i,
  /please complete/i,
  /please update/i,
  /please provide/i,
  // Deadlines & due dates
  /deadline/i,
  /due date/i,
  /due by/i,
  /due on/i,
  /expires/i,
  /expiring/i,
  /expiration/i,
  /last day/i,
  /final notice/i,
  /last chance/i,
  // Appointments & scheduling
  /appointment/i,
  /reservation/i,
  /booking confirmed/i,
  /scheduled for/i,
  /your .* is ready/i,
  /pick up/i,
  /pickup/i,
  // Reminders
  /reminder/i,
  /don't forget/i,
  /friendly reminder/i,
  /follow up/i,
  /following up/i,
  /checking in/i,
  // Requests
  /waiting for/i,
  /requires your/i,
  /needs your/i,
  /requesting/i,
  /request for/i,
  /asking for/i,
  // Bills & payments
  /payment due/i,
  /payment reminder/i,
  /bill is ready/i,
  /invoice/i,
  /statement ready/i,
  /amount due/i,
  /balance due/i,
  /pay by/i,
  /autopay/i,
  // Renewals & subscriptions
  /renewal/i,
  /renew your/i,
  /subscription/i,
  /membership/i,
  /will expire/i,
  /about to expire/i,
  // Verification & confirmation
  /verify your/i,
  /confirm your/i,
  /confirmation needed/i,
  /approval needed/i,
  /approve/i,
  // Scheduling
  /schedule your/i,
  /book your/i,
  /rsvp/i,
  // Urgency
  /time.sensitive/i,
  /urgent/i,
  /important/i,
  /asap/i,
  /immediately/i,
  /respond by/i,
  // Shipping & orders
  /shipped/i,
  /delivered/i,
  /out for delivery/i,
  /track your/i,
  /order confirmed/i,
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

function matchesTaskPattern(subject: string, snippet: string = ''): string | null {
  const textToCheck = `${subject} ${snippet}`
  for (const pattern of TASK_PATTERNS) {
    if (pattern.test(textToCheck)) {
      // Return a readable version of the matched pattern
      const match = textToCheck.match(pattern)
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
    // Include both read and unread from last 14 days, excluding promotions/social
    const listResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?' +
      new URLSearchParams({
        maxResults: '50',
        q: 'newer_than:14d -category:promotions -category:social -category:forums',
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

        const matchedPattern = matchesTaskPattern(subject, detail.snippet)
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
