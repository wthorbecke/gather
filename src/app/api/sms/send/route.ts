import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { requireAuth } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) {
    return auth // Return the error response
  }

  try {
    const { message } = await request.json()

    // Get the user's phone number from their profile (they can only send to themselves)
    const supabase = createServerClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', auth.userId)
      .single()

    if (profileError || !profile?.phone) {
      return NextResponse.json(
        { error: 'No phone number configured for your account' },
        { status: 400 }
      )
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: 'SMS service not configured' },
        { status: 500 }
      )
    }

    if (!message || typeof message !== 'string' || message.length > 1600) {
      return NextResponse.json(
        { error: 'Invalid message' },
        { status: 400 }
      )
    }

    const client = twilio(accountSid, authToken)

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: profile.phone, // Only send to the authenticated user's phone
    })

    return NextResponse.json({
      success: true,
      messageId: result.sid,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send SMS' },
      { status: 500 }
    )
  }
}
