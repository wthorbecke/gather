import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Intent patterns for parsing user messages
const COMPLETION_PATTERNS = [
  /^done$/i,
  /^done[.!]?$/i,
  /^finished$/i,
  /^complete$/i,
  /^completed$/i,
  /^did it$/i,
  /^✓$/,
  /^✔$/,
  /^👍$/,
  /^yep$/i,
  /^yes$/i,
  /^y$/i,
]

const HELP_PATTERNS = [
  /^help$/i,
  /^stuck$/i,
  /^what('?s)? next\??$/i,
  /^next$/i,
  /^\?$/,
]

const SKIP_PATTERNS = [
  /^skip$/i,
  /^later$/i,
  /^not now$/i,
]

interface Step {
  id: string | number
  text: string
  done: boolean
  summary?: string
}

interface Task {
  id: string
  title: string
  category: string
  steps: Step[] | null
}

// Create TwiML response helper
function twimlResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Normalize phone number to E.164 format for matching
function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '')
  // Ensure it starts with + for E.164
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    return '+1' + cleaned  // Assume US if 10 digits
  }
  if (!cleaned.startsWith('+') && cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned
  }
  return cleaned
}

// Webhook to receive incoming SMS messages from Twilio
export async function POST(request: NextRequest) {
  const supabase = createServerClient()

  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = (formData.get('Body') as string || '').trim()
    const messageSid = formData.get('MessageSid') as string

    // Debug log removed(`[SMS Webhook] Received from ${from}: "${body}" (sid: ${messageSid})`)

    if (!from || !body) {
      return twimlResponse("I didn't catch that. Try 'done' when you finish a step.")
    }

    // Look up user by phone number
    const normalizedPhone = normalizePhone(from)

    // Try both the original and normalized versions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone')
      .or(`phone.eq.${from},phone.eq.${normalizedPhone}`)
      .limit(1)
      .maybeSingle()

    if (profileError) {
      // Error handled silently('[SMS Webhook] Profile lookup error:', profileError)
      return twimlResponse("Something went wrong. Try again?")
    }

    if (!profile) {
      // Debug log removed(`[SMS Webhook] No user found for phone: ${from}`)
      return twimlResponse("I don't recognize this number. Set up your phone in Gather first.")
    }

    const userId = profile.id

    // Parse message intent
    const isCompletion = COMPLETION_PATTERNS.some(p => p.test(body))
    const isHelp = HELP_PATTERNS.some(p => p.test(body))
    const isSkip = SKIP_PATTERNS.some(p => p.test(body))

    // Get user's active tasks with incomplete steps
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, category, steps')
      .eq('user_id', userId)
      .neq('category', 'completed')
      .order('category')  // urgent first, then soon, then waiting

    if (tasksError) {
      // Error handled silently('[SMS Webhook] Tasks lookup error:', tasksError)
      return twimlResponse("Couldn't load your tasks. Try again?")
    }

    // Find the first task with an incomplete step
    const taskWithStep = (tasks as Task[] || []).find(t =>
      t.steps && t.steps.length > 0 && t.steps.some(s => !s.done)
    )

    if (!taskWithStep || !taskWithStep.steps) {
      if (isCompletion) {
        return twimlResponse("No pending steps right now. Nice work staying on top of things.")
      }
      if (isHelp) {
        return twimlResponse("You're all caught up! Open Gather to add new tasks.")
      }
      return twimlResponse("No active tasks. Open Gather to add something.")
    }

    // Find the first incomplete step
    const currentStep = taskWithStep.steps.find(s => !s.done)
    if (!currentStep) {
      return twimlResponse("No pending steps. Nice!")
    }

    // Handle completion intent
    if (isCompletion) {
      // Mark the step as done
      const updatedSteps = taskWithStep.steps.map(s =>
        s.id === currentStep.id ? { ...s, done: true } : s
      )

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ steps: updatedSteps })
        .eq('id', taskWithStep.id)
        .eq('user_id', userId)

      if (updateError) {
        // Error handled silently('[SMS Webhook] Step update error:', updateError)
        return twimlResponse("Couldn't mark that done. Try again?")
      }

      // Find the next incomplete step
      const nextStep = updatedSteps.find(s => !s.done)
      const allDone = !nextStep

      if (allDone) {
        // Check if all steps in this task are done
        const remainingSteps = updatedSteps.filter(s => !s.done).length
        if (remainingSteps === 0) {
          return twimlResponse(`Done! "${taskWithStep.title}" is complete. 🎉`)
        }
      }

      // Show what's next
      const stepText = nextStep ? (nextStep.summary || nextStep.text) : null
      const truncated = stepText && stepText.length > 100 ? stepText.slice(0, 97) + '...' : stepText

      return twimlResponse(
        nextStep
          ? `Got it. Next: ${truncated}`
          : `Done! "${taskWithStep.title}" is complete. 🎉`
      )
    }

    // Handle help/what's next intent
    if (isHelp) {
      const stepText = currentStep.summary || currentStep.text
      const truncated = stepText.length > 120 ? stepText.slice(0, 117) + '...' : stepText
      return twimlResponse(`Current step for "${taskWithStep.title}": ${truncated}\n\nReply 'done' when finished.`)
    }

    // Handle skip intent
    if (isSkip) {
      return twimlResponse("No worries. I'll remind you later.")
    }

    // Default: show current step status
    const stepText = currentStep.summary || currentStep.text
    const truncated = stepText.length > 100 ? stepText.slice(0, 97) + '...' : stepText
    return twimlResponse(
      `Current step: ${truncated}\n\nReply 'done' to complete, 'help' for details.`
    )

  } catch {
    // Error handled silently
    return twimlResponse("Something went wrong. Try again later.")
  }
}
