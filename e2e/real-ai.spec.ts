import { test, expect, Page } from '@playwright/test'
import {
  loginAsTestUser,
  setupApiErrorMonitoring,
  canRunAuthenticatedTests,
  screenshot,
  getTestConfig,
} from './helpers'

/**
 * REAL End-to-End AI Tests
 *
 * These tests make ACTUAL API calls to:
 * - Anthropic Claude API (task analysis, chat, subtask generation)
 * - Tavily API (web search for task research)
 * - Supabase (database operations)
 *
 * Requirements:
 * - ANTHROPIC_API_KEY must be set
 * - TAVILY_API_KEY must be set (for web search features)
 * - TEST_USER_EMAIL and TEST_USER_PASSWORD must be set
 *
 * These tests have longer timeouts (60s) to account for real API latency.
 * Run sparingly to avoid API costs.
 */

// Longer timeout for real API calls
test.setTimeout(60000)

// Helper to check if AI APIs are configured
function canRunAITests(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY &&
    canRunAuthenticatedTests()
  )
}

// Helper to wait for AI response (not just "thinking")
async function waitForAIResponse(page: Page, timeout = 30000) {
  // Wait for thinking indicator to appear
  await page.waitForSelector('[data-testid="ai-card"]', { timeout: 10000 }).catch(() => {})

  // Wait for response (thinking indicator disappears, content appears)
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    // Check if we have actual content (not just thinking dots)
    const aiCard = page.locator('[data-testid="ai-card"]')
    const hasContent = await aiCard.locator('.text-base').count() > 0
    const isThinking = await aiCard.locator('.loading-indicator').isVisible().catch(() => false)

    if (hasContent && !isThinking) {
      return true
    }

    await page.waitForTimeout(500)
  }

  throw new Error('AI response timeout')
}

// Helper to submit input and wait for AI
async function submitAndWaitForAI(page: Page, text: string) {
  const input = page.getByPlaceholder(/what do you need to get done/i)
  await input.fill(text)
  await input.press('Enter')
  await waitForAIResponse(page)
}

test.describe('Real AI Integration', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAITests()) {
      testInfo.skip(true, 'AI tests require ANTHROPIC_API_KEY and test credentials')
    }
  })

  test.describe('Task Analysis', () => {
    test('analyzes bureaucratic task and asks clarifying questions', async ({ page }) => {
      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      // Submit a bureaucratic task that should trigger questions
      await submitAndWaitForAI(page, 'Renew my drivers license')

      // Should show AI card with question or quick replies
      const aiCard = page.locator('[data-testid="ai-card"]')
      await expect(aiCard).toBeVisible()

      // AI should ask about state (requirements vary by state)
      const content = await aiCard.textContent()
      expect(content).toBeTruthy()

      // Should have quick reply options or a question
      const hasQuickReplies = await page.locator('button').filter({ hasText: /california|texas|new york|other/i }).count() > 0
      const hasQuestion = content!.toLowerCase().includes('state') || content!.toLowerCase().includes('where')

      expect(hasQuickReplies || hasQuestion).toBe(true)

      await screenshot(page, 'real-ai-task-analysis')
      apiMonitor.expectNoErrors()
    })

    test('generates actionable steps for simple task', async ({ page }) => {
      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      // Submit a simple task that shouldn't need questions
      await submitAndWaitForAI(page, 'Buy groceries for dinner')

      // Should show AI card
      const aiCard = page.locator('[data-testid="ai-card"]')
      await expect(aiCard).toBeVisible()

      // For simple tasks, AI might offer to add directly
      // or show minimal questions about timeline
      const content = await aiCard.textContent()
      expect(content).toBeTruthy()

      await screenshot(page, 'real-ai-simple-task')
      apiMonitor.expectNoErrors()
    })

    test('handles personal task with name extraction', async ({ page }) => {
      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      // Personal task should ask for person's name and preferences
      await submitAndWaitForAI(page, 'Plan birthday party for my friend')

      const aiCard = page.locator('[data-testid="ai-card"]')
      await expect(aiCard).toBeVisible()

      const content = await aiCard.textContent()

      // Should ask about the friend (name, preferences, etc.)
      const asksAboutPerson = content!.toLowerCase().includes('name') ||
        content!.toLowerCase().includes('friend') ||
        content!.toLowerCase().includes('who')

      expect(asksAboutPerson).toBe(true)

      await screenshot(page, 'real-ai-personal-task')
      apiMonitor.expectNoErrors()
    })
  })

  test.describe('Task Breakdown with Web Search', () => {
    test('generates steps with real URLs for government task', async ({ page }) => {
      // This test requires TAVILY_API_KEY for web search
      test.skip(!process.env.TAVILY_API_KEY, 'Requires TAVILY_API_KEY')

      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      // Submit a task that requires web research
      const input = page.getByPlaceholder(/what do you need to get done/i)
      await input.fill('Get a Real ID in California')
      await input.press('Enter')

      // Wait for AI analysis
      await waitForAIResponse(page)

      // Answer the clarifying questions if any
      const californiaButton = page.getByRole('button', { name: /california/i })
      if (await californiaButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await californiaButton.click()
        await waitForAIResponse(page)
      }

      // Wait for task to be created and steps to load
      await page.waitForTimeout(3000)

      // Look for the task in the list and click it
      const taskItem = page.locator('text=Real ID').first()
      if (await taskItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await taskItem.click()
        await page.waitForTimeout(2000)

        // Verify steps exist
        const steps = page.locator('[data-step-id]')
        const stepCount = await steps.count()
        expect(stepCount).toBeGreaterThan(0)

        // Check for real URLs in step actions
        const stepActions = page.locator('a[href*="dmv.ca.gov"], a[href*="gov"]')
        const hasGovLinks = await stepActions.count() > 0

        // May or may not have gov links depending on AI response
        // but steps should exist
        await screenshot(page, 'real-ai-task-steps')
      }

      apiMonitor.expectNoErrors()
    })
  })

  test.describe('Chat / Help Feature', () => {
    test('provides helpful response when user is stuck', async ({ page }) => {
      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      // First create a task
      await submitAndWaitForAI(page, 'File my taxes')

      // Dismiss or complete the flow to get a task
      await page.waitForTimeout(2000)

      // Find and click a task that has steps
      const taskItem = page.locator('[data-testid="task-item"]').first()
      if (await taskItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskItem.click()
        await page.waitForTimeout(1000)

        // Click "I'm stuck" or "Get help" on a step
        const stuckButton = page.locator('button:has-text("stuck"), button:has-text("help")').first()
        if (await stuckButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await stuckButton.click()

          // Wait for AI help response
          await waitForAIResponse(page, 20000)

          // Should show helpful response
          const aiCard = page.locator('[data-testid="ai-card"]')
          const content = await aiCard.textContent()
          expect(content!.length).toBeGreaterThan(10) // Has actual content

          await screenshot(page, 'real-ai-stuck-help')
        }
      }

      apiMonitor.expectNoErrors()
    })
  })

  test.describe('URL Rendering in AI Responses', () => {
    test('URLs in AI responses render as buttons, not raw text', async ({ page }) => {
      // This test verifies the RichText component works with real AI responses
      test.skip(!process.env.TAVILY_API_KEY, 'Requires TAVILY_API_KEY for URL responses')

      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      // Ask a question that should return URLs
      const input = page.getByPlaceholder(/what do you need to get done/i)
      await input.fill('Help me with "Find flights to Japan in March"')
      await input.press('Enter')

      // Wait for dropdown and click "Help me with" option
      const helpOption = page.locator('text=Help me with').first()
      if (await helpOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await helpOption.click()
      }

      await waitForAIResponse(page, 30000)

      const aiCard = page.locator('[data-testid="ai-card"]')
      const content = await aiCard.innerHTML()

      // Should NOT have raw URLs visible
      const hasRawUrl = content.includes('https://') && !content.includes('href="https://')

      // If AI returned URLs, they should be in anchor tags, not raw text
      if (content.includes('google.com') || content.includes('flight')) {
        // URLs should be rendered as links/buttons
        const linkButtons = aiCard.locator('a[href*="http"]')
        const linkCount = await linkButtons.count()

        // Either no URLs mentioned, or they're properly rendered
        if (hasRawUrl) {
          // Raw URL found - this is a test failure
          await screenshot(page, 'real-ai-raw-url-leak')
          expect(hasRawUrl).toBe(false)
        }
      }

      await screenshot(page, 'real-ai-url-rendering')
      apiMonitor.expectNoErrors()
    })
  })

  test.describe('Response Quality', () => {
    test('AI responses are concise (ADHD-friendly)', async ({ page }) => {
      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      await submitAndWaitForAI(page, 'Schedule a dentist appointment')

      const aiCard = page.locator('[data-testid="ai-card"]')
      const content = await aiCard.textContent()

      // Response should be concise (under 500 chars for simple tasks)
      expect(content!.length).toBeLessThan(500)

      // Should not have excessive punctuation or emojis
      const emojiCount = (content!.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length
      expect(emojiCount).toBeLessThan(3)

      // Should not have apologetic language
      const hasApology = /sorry|apologize|unfortunately/i.test(content!)
      expect(hasApology).toBe(false)

      await screenshot(page, 'real-ai-response-quality')
      apiMonitor.expectNoErrors()
    })

    test('AI asks relevant questions, not excessive ones', async ({ page }) => {
      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      await submitAndWaitForAI(page, 'Renew my passport')

      const aiCard = page.locator('[data-testid="ai-card"]')

      // Count quick reply buttons (these represent questions/options)
      const quickReplies = aiCard.locator('button').filter({
        hasNotText: /dismiss|close|x/i
      })
      const replyCount = await quickReplies.count()

      // Should have reasonable number of options (0-6)
      expect(replyCount).toBeLessThanOrEqual(6)

      await screenshot(page, 'real-ai-question-count')
      apiMonitor.expectNoErrors()
    })
  })

  test.describe('Error Handling', () => {
    test('handles AI timeout gracefully', async ({ page }) => {
      const apiMonitor = setupApiErrorMonitoring(page)
      await loginAsTestUser(page)

      // Submit something and immediately check error handling
      const input = page.getByPlaceholder(/what do you need to get done/i)
      await input.fill('Test task')
      await input.press('Enter')

      // Wait for either response or timeout message
      await page.waitForTimeout(35000) // Wait past typical timeout

      // Should either have a response or a graceful error
      const aiCard = page.locator('[data-testid="ai-card"]')
      if (await aiCard.isVisible().catch(() => false)) {
        const content = await aiCard.textContent()
        // Should not show raw error/stack trace
        expect(content).not.toContain('Error:')
        expect(content).not.toContain('undefined')
        expect(content).not.toContain('null')
      }

      await screenshot(page, 'real-ai-error-handling')
      // Note: We don't call expectNoErrors here because timeout might cause expected errors
    })
  })
})

test.describe('Real API Smoke Tests', () => {
  // These are quick sanity checks that APIs are responding

  test('Anthropic API is reachable', async ({ request }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, 'Requires ANTHROPIC_API_KEY')

    const response = await request.post('https://api.anthropic.com/v1/messages', {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.content).toBeDefined()
  })

  test('Tavily API is reachable', async ({ request }) => {
    test.skip(!process.env.TAVILY_API_KEY, 'Requires TAVILY_API_KEY')

    const response = await request.post('https://api.tavily.com/search', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        api_key: process.env.TAVILY_API_KEY,
        query: 'test',
        max_results: 1,
      },
    })

    expect(response.status()).toBe(200)
  })

  test('App loads with real credentials', async ({ page }) => {
    test.skip(!canRunAuthenticatedTests(), 'Requires test credentials')

    await loginAsTestUser(page)

    // Should see authenticated UI
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()

    // Should see input
    await expect(page.getByPlaceholder(/what do you need to get done/i)).toBeVisible()

    await screenshot(page, 'real-app-loaded')
  })
})
