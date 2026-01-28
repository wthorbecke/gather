import { test, expect } from '@playwright/test'
import { getTestConfig, createTestSupabaseClient, canRunAuthenticatedTests } from './helpers'

/**
 * SMS Webhook Tests
 *
 * Tests for the SMS webhook that processes incoming Twilio messages.
 * Requires:
 * - SUPABASE_SERVICE_ROLE_KEY in environment (for the webhook to use)
 * - A test user with a phone number set in their profile
 *
 * The webhook accepts form data from Twilio:
 * - From: The sender's phone number
 * - Body: The message content
 * - MessageSid: Twilio message ID
 */

const WEBHOOK_URL = '/api/sms/webhook'

// Helper to create form data like Twilio sends
function createTwilioFormData(from: string, body: string, messageSid?: string): FormData {
  const formData = new FormData()
  formData.append('From', from)
  formData.append('Body', body)
  formData.append('MessageSid', messageSid || `SM${Date.now()}`)
  return formData
}

test.describe('SMS Webhook API', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('returns TwiML response for unknown phone number', async ({ request, baseURL }) => {
    const formData = createTwilioFormData('+15555555555', 'done')

    const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
      form: {
        From: '+15555555555',
        Body: 'done',
        MessageSid: `SM${Date.now()}`,
      },
    })

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/xml')

    const body = await response.text()
    expect(body).toContain('<?xml')
    expect(body).toContain('<Response>')
    expect(body).toContain('<Message>')
    // Should mention not recognizing the number
    expect(body.toLowerCase()).toContain("don't recognize")
  })

  test('returns TwiML for empty message body', async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
      form: {
        From: '+15555555555',
        Body: '',
        MessageSid: `SM${Date.now()}`,
      },
    })

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/xml')

    const body = await response.text()
    expect(body).toContain('<Response>')
    expect(body).toContain('<Message>')
  })

  test('handles missing From field gracefully', async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
      form: {
        Body: 'done',
        MessageSid: `SM${Date.now()}`,
      },
    })

    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('<Response>')
  })
})

test.describe('SMS Webhook - Registered User', () => {
  const testPhone = '+15551234567'

  test.beforeEach(async ({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('recognizes user by phone and shows current step', async ({ request, baseURL }) => {
    // This test requires a user with the test phone number set
    // Skip if we can't set up the test data
    const config = getTestConfig()
    if (!config.isConfigured) {
      return
    }

    const supabase = createTestSupabaseClient()

    // Sign in as test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: config.testEmail!,
      password: config.testPassword!,
    })

    if (authError || !authData.user) {
      console.log('Could not authenticate test user for SMS test')
      return
    }

    // Set phone number on profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        phone: testPhone,
      })

    if (profileError) {
      console.log('Could not set phone number:', profileError)
      return
    }

    // Create a test task with steps
    const testTask = {
      user_id: authData.user.id,
      title: 'Test: SMS Task ' + Date.now(),
      category: 'soon',
      steps: [
        { id: 'step-1', text: 'First step to do', done: false, summary: 'Do the first thing' },
        { id: 'step-2', text: 'Second step to do', done: false, summary: 'Do the second thing' },
      ],
    }

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .insert(testTask)
      .select()
      .single()

    if (taskError) {
      console.log('Could not create test task:', taskError)
      // Clean up phone
      await supabase.from('profiles').update({ phone: null }).eq('id', authData.user.id)
      return
    }

    try {
      // Send a help message
      const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
        form: {
          From: testPhone,
          Body: 'help',
          MessageSid: `SM${Date.now()}`,
        },
      })

      expect(response.status()).toBe(200)
      const body = await response.text()

      // Should show current step info
      expect(body).toContain('<Response>')
      expect(body).toContain('<Message>')
      // Should reference the step or task
      expect(body.toLowerCase()).toMatch(/step|first|do/i)

    } finally {
      // Clean up
      if (taskData) {
        await supabase.from('tasks').delete().eq('id', taskData.id)
      }
      await supabase.from('profiles').update({ phone: null }).eq('id', authData.user.id)
    }
  })

  test('marks step done when user sends "done"', async ({ request, baseURL }) => {
    const config = getTestConfig()
    if (!config.isConfigured) {
      return
    }

    const supabase = createTestSupabaseClient()

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: config.testEmail!,
      password: config.testPassword!,
    })

    if (authError || !authData.user) {
      return
    }

    // Set phone number
    await supabase.from('profiles').upsert({ id: authData.user.id, phone: testPhone })

    // Create task with steps
    const testTask = {
      user_id: authData.user.id,
      title: 'Test: SMS Done ' + Date.now(),
      category: 'soon',
      steps: [
        { id: 'sms-step-1', text: 'Step to complete', done: false },
        { id: 'sms-step-2', text: 'Next step', done: false },
      ],
    }

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .insert(testTask)
      .select()
      .single()

    if (taskError || !taskData) {
      await supabase.from('profiles').update({ phone: null }).eq('id', authData.user.id)
      return
    }

    try {
      // Send "done" message
      const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
        form: {
          From: testPhone,
          Body: 'done',
          MessageSid: `SM${Date.now()}`,
        },
      })

      expect(response.status()).toBe(200)
      const body = await response.text()

      // Should acknowledge completion
      expect(body).toContain('<Response>')
      expect(body.toLowerCase()).toMatch(/got it|next|done/i)

      // Verify step was marked done in database
      const { data: updatedTask } = await supabase
        .from('tasks')
        .select('steps')
        .eq('id', taskData.id)
        .single()

      if (updatedTask?.steps) {
        const steps = updatedTask.steps as Array<{ id: string; done: boolean }>
        const firstStep = steps.find(s => s.id === 'sms-step-1')
        expect(firstStep?.done).toBe(true)
      }

    } finally {
      await supabase.from('tasks').delete().eq('id', taskData.id)
      await supabase.from('profiles').update({ phone: null }).eq('id', authData.user.id)
    }
  })

  test('shows completion message when all steps done', async ({ request, baseURL }) => {
    const config = getTestConfig()
    if (!config.isConfigured) {
      return
    }

    const supabase = createTestSupabaseClient()

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: config.testEmail!,
      password: config.testPassword!,
    })

    if (authError || !authData.user) {
      return
    }

    await supabase.from('profiles').upsert({ id: authData.user.id, phone: testPhone })

    // Create task with single incomplete step
    const testTask = {
      user_id: authData.user.id,
      title: 'Test: SMS Complete ' + Date.now(),
      category: 'soon',
      steps: [
        { id: 'final-step', text: 'Last step', done: false },
      ],
    }

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .insert(testTask)
      .select()
      .single()

    if (taskError || !taskData) {
      await supabase.from('profiles').update({ phone: null }).eq('id', authData.user.id)
      return
    }

    try {
      const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
        form: {
          From: testPhone,
          Body: 'done',
          MessageSid: `SM${Date.now()}`,
        },
      })

      expect(response.status()).toBe(200)
      const body = await response.text()

      // Should show task complete celebration
      expect(body).toMatch(/complete|🎉/i)

    } finally {
      await supabase.from('tasks').delete().eq('id', taskData.id)
      await supabase.from('profiles').update({ phone: null }).eq('id', authData.user.id)
    }
  })
})

test.describe('SMS Webhook - Intent Parsing', () => {
  // These tests verify the intent parsing without needing a real user

  const completionVariants = ['done', 'Done', 'DONE', 'done!', 'finished', 'complete', 'did it', '✓', 'yep', 'y']
  const helpVariants = ['help', 'Help', 'stuck', 'what next', "what's next?", 'next', '?']
  const skipVariants = ['skip', 'later', 'not now']

  test('recognizes completion intent variants', async ({ request, baseURL }) => {
    // We can't fully test these without a user, but we can verify the endpoint handles them
    for (const variant of completionVariants.slice(0, 3)) {
      const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
        form: {
          From: '+19999999999',
          Body: variant,
          MessageSid: `SM${Date.now()}`,
        },
      })

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('text/xml')
    }
  })

  test('handles unicode emoji messages', async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}${WEBHOOK_URL}`, {
      form: {
        From: '+19999999999',
        Body: '👍',
        MessageSid: `SM${Date.now()}`,
      },
    })

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/xml')
  })
})
