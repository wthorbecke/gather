import { Page, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * API Error tracking for catching PostgREST errors during tests
 */
export interface ApiError {
  url: string
  status: number
  code?: string
  message?: string
  details?: string
}

/**
 * Set up API error monitoring on a page
 * Returns an object with collected errors and a check function
 */
export function setupApiErrorMonitoring(page: Page) {
  const errors: ApiError[] = []

  // Monitor all responses for Supabase/PostgREST errors
  page.on('response', async (response) => {
    const url = response.url()

    // Only monitor Supabase API calls
    if (!url.includes('supabase') && !url.includes('/rest/v1/')) {
      return
    }

    const status = response.status()

    // Check for error status codes
    if (status >= 400) {
      try {
        const body = await response.json()
        errors.push({
          url,
          status,
          code: body.code,
          message: body.message,
          details: body.details,
        })
      } catch {
        errors.push({ url, status })
      }
    }
  })

  return {
    errors,
    /**
     * Assert no API errors occurred. Call this at the end of your test.
     */
    expectNoErrors: () => {
      if (errors.length > 0) {
        const errorDetails = errors.map(e =>
          `  - ${e.code || 'HTTP ' + e.status}: ${e.message || 'Unknown error'}\n    URL: ${e.url}${e.details ? '\n    Details: ' + e.details : ''}`
        ).join('\n')
        throw new Error(`API errors occurred during test:\n${errorDetails}`)
      }
    },
    /**
     * Get all collected errors (for custom assertions)
     */
    getErrors: () => [...errors],
    /**
     * Clear collected errors (useful for multi-step tests)
     */
    clearErrors: () => { errors.length = 0 },
  }
}

/**
 * Enter demo mode from the login page
 * Note: v17 demo mode requires sign in for full functionality
 */
export async function enterDemoMode(page: Page) {
  await page.goto('/')

  // Set onboarding complete flag before clicking demo to skip onboarding modal
  await page.evaluate(() => {
    localStorage.setItem('gather-onboarding-complete', 'true')
  })

  await page.getByRole('button', { name: /try the demo/i }).click()
  // Wait for the app to load
  await page.waitForTimeout(1000)

  // Dismiss all demo cards by clicking action buttons repeatedly
  // Demo mode shows a stack of sample cards with different button texts:
  // "Add as task", "Noted", "Done", "Break it down"
  for (let i = 0; i < 10; i++) {
    const actionButtons = [
      page.getByRole('button', { name: /^add as task$/i }),
      page.getByRole('button', { name: /^noted$/i }),
      page.getByRole('button', { name: /^done$/i }),
      page.getByRole('button', { name: /^break it down$/i }),
      page.getByRole('button', { name: /add task without steps/i }),
    ]

    let clicked = false
    for (const btn of actionButtons) {
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(800)
        clicked = true
        break
      }
    }

    // If no action buttons visible, we're done with demo cards
    if (!clicked) break
  }

  // Also dismiss any AI error cards by clicking X or dismiss
  const closeButton = page.locator('button:has(svg path[d*="M6 18L18 6"]), button:has(svg path[d*="M18 6L6 18"])').first()
  if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeButton.click()
    await page.waitForTimeout(300)
  }

  // Wait for the main app content to be ready
  await page.waitForTimeout(500)
}

/**
 * Navigate to a specific tab (DEPRECATED - v17 has no tabs)
 * Kept for backward compatibility with old tests
 */
export async function navigateToTab(page: Page, tabName: 'Today' | 'Soul' | 'Tasks' | 'Money' | 'Space') {
  // v17 has no tabs - all content is on single page
  // Just wait for app to load
  await page.waitForTimeout(300)
}

/**
 * Add a new task using the unified input (v17)
 * Handles the AI analysis flow automatically
 */
export async function addTask(
  page: Page,
  title: string,
  options?: {
    description?: string
    category?: 'urgent' | 'soon' | 'waiting'
    badge?: string
  }
) {
  // Use the unified input
  const unifiedInput = page.getByPlaceholder(/what do you need to get done/i)
  await unifiedInput.fill(title)
  await unifiedInput.press('Enter')

  // Wait for AI response - could show thinking, then quick replies
  // The app has a timeout, so we wait up to 10 seconds
  await page.waitForTimeout(1000)

  // Check for quick replies and click the first one if present
  const quickReply = page.locator('button:has-text("No rush"), button:has-text("This month"), button:has-text("ASAP")').first()
  if (await quickReply.isVisible({ timeout: 5000 }).catch(() => false)) {
    await quickReply.click()
    await page.waitForTimeout(1000)
  }

  // Dismiss AI card if still visible
  const dismissButton = page.locator('.animate-fade-in button[class*="absolute"]').first()
  if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dismissButton.click()
    await page.waitForTimeout(300)
  }
}

/**
 * Quick add a task without AI (v17)
 */
export async function quickAddTask(page: Page, title: string) {
  // Type in the unified input
  const unifiedInput = page.getByPlaceholder(/what do you need to get done/i)
  await unifiedInput.fill(title)

  // Wait for dropdown to appear, then click "Add" option
  await page.waitForTimeout(300)
  const addOption = page.locator(`text=Add "${title}"`).first()
  if (await addOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    await addOption.click()
    await page.waitForTimeout(500)
  }
}

/**
 * Verify a task exists in the list
 */
export async function expectTaskVisible(page: Page, title: string) {
  await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 15000 })
}

/**
 * Click on a task to open the task view (v17)
 */
export async function openTask(page: Page, taskTitle: string) {
  await page.locator(`text=${taskTitle}`).first().click()
  // Wait for task view to load
  await page.waitForTimeout(300)
}

/**
 * Go back from task view to home (v17)
 */
export async function goBackToHome(page: Page) {
  await page.locator('button:has(svg path[d*="M10 12L6 8L10 4"])').click()
  await page.waitForTimeout(300)
}

/**
 * Toggle a step checkbox in task view (v17)
 */
export async function toggleStep(page: Page, stepText: string) {
  const stepRow = page.locator(`text=${stepText}`).locator('..')
  const checkbox = stepRow.locator('button').first()
  await checkbox.click()
}

/**
 * Toggle a habit checkbox (DEPRECATED - v17 has no habits panel)
 */
export async function toggleHabit(page: Page, habitName: string) {
  const habitItem = page.locator(`text=${habitName}`).locator('..')
  await habitItem.locator('input[type="checkbox"], [role="checkbox"]').click()
}

/**
 * Check if a habit is completed (DEPRECATED - v17 has no habits panel)
 */
export async function isHabitCompleted(page: Page, habitName: string): Promise<boolean> {
  const habitRow = page.locator(`text=${habitName}`).locator('..')
  const checkbox = habitRow.locator('input[type="checkbox"]')
  return await checkbox.isChecked()
}

/**
 * Take a labeled screenshot for debugging
 */
export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e-screenshots/${name}.png`, fullPage: true })
}

/**
 * Wait for loading to complete
 */
export async function waitForAppLoad(page: Page) {
  // Wait for loading dots to disappear
  await page.waitForSelector('.loading-dot', { state: 'hidden', timeout: 10000 }).catch(() => {
    // Loading might already be done
  })
  // Wait for main content
  await page.waitForSelector('text=Gather', { timeout: 10000 })
}

// ============ AUTHENTICATED TESTING ============

/**
 * Test environment configuration
 */
export function getTestConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const testEmail = process.env.TEST_USER_EMAIL
  const testPassword = process.env.TEST_USER_PASSWORD

  return {
    supabaseUrl,
    supabaseAnonKey,
    testEmail,
    testPassword,
    isConfigured: !!(supabaseUrl && supabaseAnonKey && testEmail && testPassword),
  }
}

/**
 * Create a Supabase client for testing
 */
export function createTestSupabaseClient() {
  const config = getTestConfig()
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase URL and anon key must be configured for authenticated tests')
  }
  return createClient(config.supabaseUrl, config.supabaseAnonKey)
}

/**
 * Create a Supabase admin client (service role) for cleanup operations
 */
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for admin operations')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

/**
 * Sign in as the test user and inject session into the page
 * This allows testing authenticated flows with real API calls
 */
export async function loginAsTestUser(page: Page) {
  const config = getTestConfig()

  if (!config.isConfigured) {
    throw new Error(
      'Test credentials not configured. Set these env vars:\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL\n' +
      '  - NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      '  - TEST_USER_EMAIL\n' +
      '  - TEST_USER_PASSWORD'
    )
  }

  const supabase = createTestSupabaseClient()

  // Authenticate via Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.testEmail!,
    password: config.testPassword!,
  })

  if (error) {
    throw new Error(`Failed to authenticate test user: ${error.message}`)
  }

  if (!data.session) {
    throw new Error('No session returned from authentication')
  }

  // Navigate to the app first (needed to set localStorage on the correct origin)
  await page.goto('/')

  // Inject the session into localStorage (this is how Supabase stores auth state)
  const storageKey = `sb-${new URL(config.supabaseUrl!).hostname.split('.')[0]}-auth-token`

  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, { key: storageKey, session: data.session })

  // Reload to pick up the session
  await page.reload()

  // Wait for page to fully load after auth
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

  // Wait for authenticated state - either main input, task cards, or Gather heading
  await page.waitForSelector('h1:has-text("Gather"), input[placeholder*="next"], [data-testid="task-item"]', { timeout: 15000 })

  // Give the app a moment to render fully
  await page.waitForTimeout(1000)

  // If we're in a task view, navigate back to home
  const backButton = page.locator('button:has(svg path[d*="M10 12L6 8"])').first()
  let attempts = 0
  while (await backButton.isVisible({ timeout: 500 }).catch(() => false) && attempts < 5) {
    await backButton.click()
    await page.waitForTimeout(500)
    attempts++
  }

  return data.session
}

/**
 * Sign out the test user
 */
export async function logoutTestUser(page: Page) {
  const config = getTestConfig()
  const storageKey = `sb-${new URL(config.supabaseUrl!).hostname.split('.')[0]}-auth-token`

  await page.evaluate((key) => {
    localStorage.removeItem(key)
  }, storageKey)

  await page.reload()
}

/**
 * Clean up test data for a user (call after tests to reset state)
 */
export async function cleanupTestUserData(userId: string) {
  const supabase = createTestSupabaseClient()

  // Delete test tasks (keep only starter tasks by checking created_at or title patterns)
  await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .like('title', 'Test:%')  // Convention: prefix test-created tasks with "Test:"

  // Delete test habits
  await supabase
    .from('habits')
    .delete()
    .eq('user_id', userId)
    .like('name', 'Test:%')

  // Could add more cleanup as needed
}

/**
 * Clear ALL tasks for a user (use before tests to ensure clean state)
 * Uses service role to bypass RLS
 */
export async function clearAllTestUserTasks(userId: string) {
  const supabase = createAdminSupabaseClient()

  // First delete all subtasks
  await supabase
    .from('subtasks')
    .delete()
    .eq('user_id', userId)

  // Then delete all tasks
  await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)
}

/**
 * Check if authenticated tests can run
 */
export function canRunAuthenticatedTests(): boolean {
  return getTestConfig().isConfigured
}
