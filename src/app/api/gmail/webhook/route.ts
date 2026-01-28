import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getValidToken } from '@/lib/google-auth'

interface PubSubMessage {
  message: {
    data: string  // Base64 encoded JSON
    messageId: string
    publishTime: string
  }
  subscription: string
}

interface GmailNotification {
  emailAddress: string
  historyId: string
}

/**
 * Gmail Pub/Sub webhook endpoint.
 * Receives push notifications when user's Gmail changes.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from Google Pub/Sub
    const webhookSecret = process.env.GOOGLE_WEBHOOK_SECRET
    const authHeader = request.headers.get('authorization')

    // Basic verification - in production, use proper Pub/Sub verification
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.warn('[GmailWebhook] Invalid authorization header')
      // Still return 200 to prevent retries, but log the issue
    }

    const body: PubSubMessage = await request.json()

    if (!body.message?.data) {
      console.error('[GmailWebhook] No message data in request')
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
    }

    // Decode the base64 message
    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8')
    const notification: GmailNotification = JSON.parse(decodedData)

    console.log('[GmailWebhook] Received notification:', {
      email: notification.emailAddress,
      historyId: notification.historyId,
      messageId: body.message.messageId,
    })

    const supabase = createServerClient()

    // Find the user by email
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (
        await supabase.auth.admin.listUsers()
      ).data.users.find(u => u.email === notification.emailAddress)?.id)

    // Alternative approach: look up user by their Google email in auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUser = authUsers.users.find(u => u.email === notification.emailAddress)

    if (!authUser) {
      console.warn('[GmailWebhook] No user found for email:', notification.emailAddress)
      return NextResponse.json({ status: 'user_not_found' })
    }

    const userId = authUser.id

    // Get the user's watch info
    const { data: watch, error: watchError } = await supabase
      .from('google_watches')
      .select('*')
      .eq('user_id', userId)
      .eq('resource_type', 'gmail')
      .single()

    if (watchError || !watch) {
      console.warn('[GmailWebhook] No watch found for user:', userId)
      return NextResponse.json({ status: 'no_watch' })
    }

    // Check if we have a history ID to do incremental sync
    const previousHistoryId = watch.history_id

    // Get a valid access token
    const accessToken = await getValidToken(userId)
    if (!accessToken) {
      console.error('[GmailWebhook] Could not get valid token for user:', userId)
      return NextResponse.json({ status: 'token_error' })
    }

    // Fetch history changes since last sync
    if (previousHistoryId) {
      const historyResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/history?` +
        new URLSearchParams({
          startHistoryId: previousHistoryId,
          historyTypes: 'messageAdded',
        }),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (historyResponse.ok) {
        const historyData = await historyResponse.json()

        if (historyData.history) {
          // Process new messages
          const newMessageIds: string[] = []
          for (const item of historyData.history) {
            if (item.messagesAdded) {
              for (const msg of item.messagesAdded) {
                newMessageIds.push(msg.message.id)
              }
            }
          }

          if (newMessageIds.length > 0) {
            console.log('[GmailWebhook] Found new messages:', newMessageIds.length)

            // Queue messages for AI analysis (in a real implementation,
            // this would call a background job or queue)
            await processNewMessages(userId, newMessageIds, accessToken, supabase)
          }
        }
      }
    }

    // Update the stored history ID
    await supabase
      .from('google_watches')
      .update({ history_id: notification.historyId })
      .eq('user_id', userId)
      .eq('resource_type', 'gmail')

    // Return 200 to acknowledge receipt
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[GmailWebhook] Error processing webhook:', error)
    // Return 200 anyway to prevent Pub/Sub retries
    return NextResponse.json({ status: 'error', message: 'Internal error' })
  }
}

/**
 * Process new messages for potential task detection.
 */
async function processNewMessages(
  userId: string,
  messageIds: string[],
  accessToken: string,
  supabase: ReturnType<typeof createServerClient>
) {
  // Check which messages we've already processed
  const { data: processed } = await supabase
    .from('processed_emails')
    .select('gmail_message_id')
    .eq('user_id', userId)
    .in('gmail_message_id', messageIds)

  const processedIds = new Set((processed || []).map(p => p.gmail_message_id))
  const newIds = messageIds.filter(id => !processedIds.has(id))

  if (newIds.length === 0) {
    console.log('[GmailWebhook] All messages already processed')
    return
  }

  // Process each new message (limit to prevent overload)
  for (const messageId of newIds.slice(0, 5)) {
    try {
      // Fetch message details
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) continue

      const message = await response.json()

      // Mark as processed (we'll analyze later via the analyze endpoint)
      await supabase
        .from('processed_emails')
        .upsert({
          user_id: userId,
          gmail_message_id: messageId,
          action_taken: 'ignored', // Will be updated if user creates task
          processed_at: new Date().toISOString(),
        })

      console.log('[GmailWebhook] Processed message:', messageId)
    } catch (error) {
      console.error('[GmailWebhook] Error processing message:', messageId, error)
    }
  }
}

// Verify GET requests (Google sometimes sends verification requests)
export async function GET() {
  return NextResponse.json({ status: 'Gmail webhook endpoint active' })
}
