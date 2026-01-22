import { Page, expect, APIRequestContext } from '@playwright/test'
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
 */
export async function enterDemoMode(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /try demo/i }).click()
  await page.waitForSelector('text=Today')
}

/**
 * Navigate to a specific tab
 */
export async function navigateToTab(page: Page, tabName: 'Today' | 'Soul' | 'Tasks' | 'Money' | 'Space') {
  await page.getByRole('button', { name: tabName }).click()
  // Wait for tab content to load
  await page.waitForTimeout(300)
}

/**
 * Add a new task using the quick capture input
 * Handles the AI analysis flow automatically (waits for AI or timeout)
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
  // Use the quick capture input (always visible at top)
  const quickInput = page.getByPlaceholder(/what's on your mind/i)
  await quickInput.fill(title)
  await quickInput.press('Enter')

  // Wait for AI analysis - could show "Thinking...", then modal, or just add task
  // The app has an 8-second timeout for AI, so we wait up to 12 seconds
  const skipButton = page.getByRole('button', { name: /skip all/i })
  if (await skipButton.isVisible({ timeout: 12000 }).catch(() => false)) {
    await skipButton.click()
    // Wait for modal to close
    await expect(skipButton).not.toBeVisible({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
  } else {
    // No modal appeared - AI either added task directly or timed out
    await page.waitForTimeout(1000)
  }
}

/**
 * Verify a task exists in the list
 * Uses longer timeout to account for AI analysis
 */
export async function expectTaskVisible(page: Page, title: string) {
  await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 15000 })
}

/**
 * Toggle a habit checkbox
 */
export async function toggleHabit(page: Page, habitName: string) {
  const habitItem = page.locator(`text=${habitName}`).locator('..')
  await habitItem.locator('input[type="checkbox"], [role="checkbox"]').click()
}

/**
 * Check if a habit is completed
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
  
  // Wait for authenticated state
  await page.waitForSelector('text=Today', { timeout: 10000 })
  
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
 * Check if authenticated tests can run
 */
export function canRunAuthenticatedTests(): boolean {
  return getTestConfig().isConfigured
}
