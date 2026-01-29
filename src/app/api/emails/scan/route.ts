import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken } from '@/lib/google-auth'
import {
  checkRateLimit,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rateLimit'

// In-memory cache for scan results (5 minute TTL)
// This avoids repeated expensive Gmail API calls within a session
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
interface CacheEntry {
  data: {
    potentialTasks: PotentialTask[]
    scannedCount: number
    beforeDedup: number
    message: string
  }
  timestamp: number
}
const scanCache = new Map<string, CacheEntry>()

// Clean up expired cache entries periodically
function cleanupCache() {
  const now = Date.now()
  const keysToDelete: string[] = []
  scanCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => scanCache.delete(key))
}

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

// Patterns that indicate an email is NOT actionable (informational only)
const FALSE_POSITIVE_PATTERNS = [
  // Shipping notifications (informational - package is on its way or arrived)
  /your (order|package|shipment) (has been |was |is )?(delivered|shipped|sent)/i,
  /has been delivered/i,
  /is out for delivery/i,
  /is on the way/i,
  /tracking (number|info|update)/i,

  // Order confirmations (already placed, nothing to do)
  /thanks for your order/i,
  /order confirmed/i,
  /order received/i,
  /we received your order/i,

  // Receipts
  /your receipt/i,
  /payment received/i,
  /payment successful/i,
  /transaction complete/i,

  // Marketing re-engagement
  /we miss you/i,
  /haven't seen you/i,
  /been a while/i,
  /ghosting/i,
  /come back/i,
  /we noticed you/i,

  // Autopay confirmations
  /autopay (is |will be )?(enabled|scheduled|set up)/i,
  /automatic payment (is |will be )?scheduled/i,
  /no action (is )?needed/i,
  /no action required/i,

  // Already canceled/done
  /subscription (was |has been )?cancel/i,
  /successfully cancel/i,
  /you('ve| have) unsubscribed/i,

  // Feedback/survey requests (optional)
  /take (a |our )?survey/i,
  /feedback request/i,
  /how did we do/i,
  /rate your experience/i,

  // Newsletters/digests
  /weekly digest/i,
  /daily digest/i,
  /newsletter/i,
  /monthly update/i,

  // Otter/transcription ready (informational)
  /ready to view in otter/i,
  /transcript is ready/i,
]

// Check if email is likely a false positive
function isLikelyFalsePositive(subject: string, snippet: string, from: string): boolean {
  const text = `${subject} ${snippet}`.toLowerCase()

  // Check against false positive patterns
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return true
    }
  }

  // Amazon shipped/delivered are almost never actionable
  if (from.toLowerCase().includes('amazon') &&
      /(shipped|delivered|out for delivery)/i.test(subject)) {
    return true
  }

  return false
}

// De-duplicate emails with same subject from same sender
function deduplicateEmails(emails: PotentialTask[]): PotentialTask[] {
  const seen = new Map<string, PotentialTask>()

  for (const email of emails) {
    // Create a key from sender + normalized subject
    const normalizedSubject = email.subject
      .replace(/\[.*?\]/g, '') // Remove bracketed prefixes
      .replace(/^(re|fwd|fw):\s*/i, '') // Remove Re:/Fwd:
      .trim()
      .toLowerCase()

    const key = `${email.from.toLowerCase()}:${normalizedSubject}`

    // Keep the most recent one (first in list since sorted by date)
    if (!seen.has(key)) {
      seen.set(key, email)
    }
  }

  return Array.from(seen.values())
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
  // Rate limiting - email scanning is expensive
  const identifier = getRequestIdentifier(request)
  const rateCheck = checkRateLimit(identifier, RATE_LIMITS.emailScan)
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck)
  }

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

    // Check cache first - avoid expensive Gmail API calls
    cleanupCache()
    const cacheKey = user.id
    const cached = scanCache.get(cacheKey)
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'

    if (cached && !forceRefresh && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      // Debug log removed(`[EmailScan] Cache hit for user ${user.id.slice(0, 8)}...`)
      return NextResponse.json({ ...cached.data, cached: true })
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
    // Include both read and unread from last 90 days, excluding promotions/social/forums
    const listResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?' +
      new URLSearchParams({
        maxResults: '100',
        q: 'newer_than:90d -category:promotions -category:social -category:forums',
      }),
      {
        headers: {
          Authorization: `Bearer ${gmailToken}`,
        },
      }
    )

    if (!listResponse.ok) {
      const errorText = await listResponse.text()
      // Error handled silently('Gmail API error:', listResponse.status, errorText)

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

    // Fetch message details - check up to 100 emails
    const potentialTasks: PotentialTask[] = []

    for (const msg of messages.slice(0, 100)) {
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
          // Filter out likely false positives
          if (!isLikelyFalsePositive(subject, detail.snippet, from)) {
            potentialTasks.push({
              id: msg.id,
              subject,
              from: extractSenderName(from),
              snippet: detail.snippet,
              date: new Date(date).toLocaleDateString(),
              matchedPattern,
            })
          }
        }
      } catch (err) {
        // Error handled silently('Error fetching message detail:', err)
      }
    }

    // De-duplicate similar emails from same sender
    const dedupedTasks = deduplicateEmails(potentialTasks)

    // Cache the result
    const responseData = {
      potentialTasks: dedupedTasks,
      scannedCount: messages.length,
      beforeDedup: potentialTasks.length,
      message: dedupedTasks.length > 0
        ? `Found ${dedupedTasks.length} emails that might need action`
        : 'No actionable emails found'
    }

    scanCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    })
    // Debug log removed(`[EmailScan] Cached results for user ${user.id.slice(0, 8)}... (${dedupedTasks.length} tasks)`)

    return NextResponse.json(responseData)

  } catch (error) {
    // Error handled silently('Error scanning emails:', error)
    return NextResponse.json({ error: 'Failed to scan emails' }, { status: 500 })
  }
}
