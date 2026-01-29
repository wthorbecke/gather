import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

/**
 * Get and update insight frequency preference
 */

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('insight_frequency')
    .eq('id', auth.userId)
    .single()

  return NextResponse.json({
    frequency: profile?.insight_frequency || 'normal',
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await request.json()
    const { frequency } = body

    if (!['off', 'minimal', 'normal', 'frequent'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ insight_frequency: frequency })
      .eq('id', auth.userId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ success: true, frequency })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
