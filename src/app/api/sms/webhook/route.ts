import { NextRequest, NextResponse } from 'next/server'

// Webhook to receive incoming SMS messages from Twilio
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    console.log(`Received SMS from ${from}: ${body}`)

    // TODO: Process incoming message
    // - Look up user by phone number
    // - Parse message intent (e.g., "done" to mark tasks complete)
    // - Store in database
    // - Potentially trigger AI response

    // For now, just acknowledge receipt
    // TwiML response to acknowledge
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Got it! I'll note that.</Message>
</Response>`

    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error) {
    console.error('SMS webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process incoming SMS' },
      { status: 500 }
    )
  }
}
