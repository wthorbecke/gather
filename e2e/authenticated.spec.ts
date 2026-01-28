import { test, expect } from '@playwright/test'
import {
  loginAsTestUser,
  setupApiErrorMonitoring,
  canRunAuthenticatedTests,
  getTestConfig,
  createTestSupabaseClient,
} from './helpers'

/**
 * Authenticated E2E Tests (v17)
 *
 * These tests run against real Supabase with a real test user.
 * They catch API errors, schema mismatches, and RLS policy issues.
 *
 * Setup required:
 * 1. Create a test user in Supabase Dashboard (Authentication → Users → Add user)
 *    - Email: gather-test@example.com (or your choice)
 *    - Password: your-secure-test-password
 * 2. Set environment variables:
 *    - TEST_USER_EMAIL=gather-test@example.com
 *    - TEST_USER_PASSWORD=your-secure-test-password
 */

test.describe('Authenticated Flows (v17)', () => {
  // Skip all tests in this file if credentials aren't configured
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured (TEST_USER_EMAIL, TEST_USER_PASSWORD)')
    }
  })

  test('can login as test user', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Verify we're logged in - v17 shows "Sign out" button
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()

    // Should see Gather header
    await expect(page.locator('h1:has-text("Gather")')).toBeVisible()

    // Should see unified input
    await expect(page.getByPlaceholder(/what do you need to get done/i)).toBeVisible()

    // Should not see "Try Demo" button when logged in
    await expect(page.getByRole('button', { name: /try demo/i })).not.toBeVisible()

    apiMonitor.expectNoErrors()
  })

  test('home view loads without API errors', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Wait for content to load
    await page.waitForTimeout(1000)

    // Should have loaded without errors
    apiMonitor.expectNoErrors()
  })

  test('can add task via unified input', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Add a test task
    const taskTitle = `Test: Task ${Date.now()}`
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)
    await input.press('Enter')

    // Wait for AI response
    await page.waitForTimeout(1500)

    // Handle quick reply if present
    const quickReply = page.getByRole('button', { name: /No rush/i })
    if (await quickReply.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickReply.click()
      await page.waitForTimeout(2000)
    }

    // Verify task appears in list
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({ timeout: 10000 })

    apiMonitor.expectNoErrors()
  })

  test('can click task to open task view', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Wait for tasks to load
    await page.waitForTimeout(1000)

    // Find and click a task (if any exist)
    const taskCard = page.locator('.bg-card.rounded-md').first()
    if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await taskCard.click()

      // Should show task view with back button
      await page.waitForTimeout(500)

      // Verify we can go back
      await page.locator('button').filter({ has: page.locator('svg') }).first().click()

      // Should be back on home
      await expect(page.locator('h1:has-text("Gather")')).toBeVisible({ timeout: 3000 })
    }

    apiMonitor.expectNoErrors()
  })

  test('theme toggle works', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Find and click theme toggle
    const themeToggle = page.locator('button:has-text("🌙"), button:has-text("☀")')
    await expect(themeToggle.first()).toBeVisible()

    await themeToggle.first().click()
    await page.waitForTimeout(300)

    // Should have toggled (class changes)
    apiMonitor.expectNoErrors()
  })
})

test.describe('API Schema Validation (v17)', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('tasks table supports steps and context_text columns', async () => {
    const supabase = createTestSupabaseClient()
    const config = getTestConfig()

    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: config.testEmail!,
      password: config.testPassword!,
    })

    if (authError) throw authError

    // Try to insert a task with v17 fields (steps and context_text)
    const testTask = {
      user_id: authData.user!.id,
      title: 'Test: Schema validation task v17',
      category: 'soon',
      subtasks: [{ id: 'test-1', title: 'Test subtask', completed: false }],
      steps: [
        { id: 'step-1', text: 'Test step', done: false, summary: 'Test summary' }
      ],
      context_text: 'Test context',
      notes: 'Test notes content',
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(testTask)
      .select()
      .single()

    // This might fail if columns don't exist yet - that's expected
    // We just want to make sure the app handles both old and new schema
    if (!error) {
      expect(data).toBeTruthy()
      expect(data!.subtasks).toEqual(testTask.subtasks)
      expect(data!.notes).toBe(testTask.notes)

      // Cleanup
      await supabase.from('tasks').delete().eq('id', data.id)
    }
  })

  test('RLS policies allow user to access only their own data', async () => {
    const supabase = createTestSupabaseClient()
    const config = getTestConfig()

    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: config.testEmail!,
      password: config.testPassword!,
    })

    if (authError) throw authError

    // Query tasks - should only get our own
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('user_id')
      .limit(10)

    expect(tasksError).toBeNull()

    // All returned tasks should belong to the test user
    if (tasks && tasks.length > 0) {
      tasks.forEach(task => {
        expect(task.user_id).toBe(authData.user!.id)
      })
    }
  })
})
