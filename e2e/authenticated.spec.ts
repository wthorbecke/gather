import { test, expect } from '@playwright/test'
import {
  loginAsTestUser,
  logoutTestUser,
  navigateToTab,
  setupApiErrorMonitoring,
  canRunAuthenticatedTests,
  getTestConfig,
  createTestSupabaseClient,
} from './helpers'

/**
 * Authenticated E2E Tests
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

test.describe('Authenticated Flows', () => {
  // Skip all tests in this file if credentials aren't configured
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured (TEST_USER_EMAIL, TEST_USER_PASSWORD)')
    }
  })

  test('can login as test user', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await loginAsTestUser(page)
    
    // Verify we're logged in (not seeing login page)
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
    
    // Should not see "Try Demo" button when logged in
    await expect(page.getByRole('button', { name: /try demo/i })).not.toBeVisible()
    
    apiMonitor.expectNoErrors()
  })

  test('Today panel loads real habits', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await loginAsTestUser(page)
    await navigateToTab(page, 'Today')
    
    // Should see habit sections (real data or seeded defaults)
    await expect(page.locator('text=morning').or(page.locator('text=Morning'))).toBeVisible({ timeout: 5000 })
    
    apiMonitor.expectNoErrors()
  })

  test('Tasks panel loads and can add tasks', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await loginAsTestUser(page)
    await navigateToTab(page, 'Tasks')
    
    // Add a test task (prefixed for easy cleanup)
    const taskTitle = `Test: Task ${Date.now()}`
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill(taskTitle)
    await quickInput.press('Enter')
    
    // Handle breakdown modal if it appears
    const breakdownModal = page.locator('text=That sounds like a big one')
    if (await breakdownModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByRole('button', { name: /just add it as is/i }).click()
    }
    
    // Verify task appears
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({ timeout: 5000 })
    
    apiMonitor.expectNoErrors()
  })

  test('Soul panel loads real activities', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await loginAsTestUser(page)
    await navigateToTab(page, 'Soul')
    
    // Should see soul activities (seeded defaults or user-created)
    // Just verify the panel loaded without errors
    await page.waitForTimeout(1000)
    
    apiMonitor.expectNoErrors()
  })

  test('can open task detail modal and interact with subtasks', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await loginAsTestUser(page)
    await navigateToTab(page, 'Tasks')
    
    // Click on a task to open detail modal
    const taskCard = page.locator('[data-testid="task-card"]').first()
    if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await taskCard.click()
      
      // Wait for modal to open
      await expect(page.locator('text=Break it down')).toBeVisible({ timeout: 3000 })
      
      // Try adding a subtask
      const subtaskInput = page.getByPlaceholder(/add a step/i)
      await subtaskInput.fill('Test: Subtask ' + Date.now())
      await page.getByRole('button', { name: 'Add' }).click()
      
      // Close modal
      await page.getByRole('button', { name: 'Close' }).click()
    }
    
    apiMonitor.expectNoErrors()
  })

  test('task notes persist correctly', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await loginAsTestUser(page)
    await navigateToTab(page, 'Tasks')
    
    // Find a task card and click it
    const taskCard = page.locator('[data-testid="task-card"]').first()
    if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await taskCard.click()
      
      // Add a note
      const noteContent = `Test note at ${Date.now()}`
      const notesTextarea = page.getByPlaceholder(/add any context/i)
      await notesTextarea.fill(noteContent)
      
      // Close and reopen to verify persistence
      await page.getByRole('button', { name: 'Close' }).click()
      await taskCard.click()
      
      // Verify note persisted
      await expect(page.getByPlaceholder(/add any context/i)).toHaveValue(noteContent)
      
      await page.getByRole('button', { name: 'Close' }).click()
    }
    
    apiMonitor.expectNoErrors()
  })
})

test.describe('API Schema Validation (Authenticated)', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('tasks table supports subtasks and notes columns', async () => {
    const supabase = createTestSupabaseClient()
    const config = getTestConfig()
    
    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: config.testEmail!,
      password: config.testPassword!,
    })
    
    if (authError) throw authError
    
    // Try to insert a task with subtasks and notes
    const testTask = {
      user_id: authData.user!.id,
      title: 'Test: Schema validation task',
      category: 'soon',
      subtasks: [{ id: 'test-1', title: 'Test subtask', completed: false }],
      notes: 'Test notes content',
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(testTask)
      .select()
      .single()
    
    // This will fail if columns don't exist
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data!.subtasks).toEqual(testTask.subtasks)
    expect(data!.notes).toBe(testTask.notes)
    
    // Cleanup
    if (data) {
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
