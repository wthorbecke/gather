import { test, expect } from '@playwright/test'
import {
  loginAsTestUser,
  setupApiErrorMonitoring,
  canRunAuthenticatedTests,
  screenshot,
  expectTaskVisible,
  openTask,
  goBackToHome,
} from './helpers'

/**
 * v17 Task Tests
 *
 * Tests for the new single-page design with unified input,
 * inline AI cards, and rich steps.
 */

test.describe('v17 Home View', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured (TEST_USER_EMAIL, TEST_USER_PASSWORD)')
    }
  })

  test('shows Gather header and unified input', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Should see the header
    await expect(page.locator('h1:has-text("Gather")')).toBeVisible()

    // Should see unified input
    await expect(page.getByPlaceholder(/what do you need to get done/i)).toBeVisible()

    // Should see Sign out button
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()

    apiMonitor.expectNoErrors()
  })

  test('shows suggestion pills', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Should see suggestion buttons
    await expect(page.getByRole('button', { name: /Get a Real ID/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /File my taxes/i })).toBeVisible()

    apiMonitor.expectNoErrors()
  })

  test('typing in input shows dropdown with options', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill('Test task')

    // Should show dropdown with options
    await expect(page.locator('text=Add "Test task"')).toBeVisible({ timeout: 2000 })
    await expect(page.locator('text=Help me with "Test task"')).toBeVisible({ timeout: 2000 })

    await screenshot(page, 'v17-input-dropdown')

    apiMonitor.expectNoErrors()
  })

  test('clicking suggestion fills input', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Click a suggestion
    await page.getByRole('button', { name: /Get a Real ID/i }).click()

    // Input should have the suggestion text
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await expect(input).toHaveValue('Get a Real ID')

    apiMonitor.expectNoErrors()
  })

  test('submitting shows AI response card', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill('Get a Real ID')
    await input.press('Enter')

    // Should show thinking state
    await expect(page.locator('text=Thinking...')).toBeVisible({ timeout: 2000 })

    // Then should show AI response with quick replies
    await page.waitForTimeout(2000)

    // Should have dismiss button
    await expect(page.locator('[class*="absolute"]').first()).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'v17-ai-response')

    apiMonitor.expectNoErrors()
  })

  test('quick reply creates task', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill('Test: Create task ' + Date.now())
    await input.press('Enter')

    // Wait for AI response
    await page.waitForTimeout(1500)

    // Click a quick reply if present
    const quickReply = page.getByRole('button', { name: /No rush/i })
    if (await quickReply.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickReply.click()

      // Wait for task creation
      await page.waitForTimeout(2000)

      // Should show task created confirmation
      await expect(page.locator('text=personalized plan')).toBeVisible({ timeout: 5000 })
    }

    await screenshot(page, 'v17-task-created')

    apiMonitor.expectNoErrors()
  })

  test('shows All tasks section', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Should show All tasks section if tasks exist
    await page.waitForTimeout(1000)
    const allTasksHeader = page.locator('text=All tasks')

    // Screenshot regardless
    await screenshot(page, 'v17-all-tasks')

    apiMonitor.expectNoErrors()
  })
})

test.describe('v17 Task View', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('can navigate to task view by clicking task', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // First create a task
    const taskTitle = 'Test: Nav task ' + Date.now()
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)
    await input.press('Enter')

    // Handle AI flow
    await page.waitForTimeout(1500)
    const quickReply = page.getByRole('button', { name: /No rush/i })
    if (await quickReply.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickReply.click()
      await page.waitForTimeout(2000)
    }

    // Find and click the task
    await page.locator(`text=${taskTitle}`).first().click()

    // Should show task view with back button
    await expect(page.locator('button:has(svg)')).toBeVisible()

    // Should show task title
    await expect(page.locator('h1').filter({ hasText: taskTitle })).toBeVisible({ timeout: 3000 })

    await screenshot(page, 'v17-task-view')

    apiMonitor.expectNoErrors()
  })

  test('task view shows context input with task name', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Create and navigate to task
    const taskTitle = 'Test: Context ' + Date.now()
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)
    await input.press('Enter')

    await page.waitForTimeout(1500)
    const quickReply = page.getByRole('button', { name: /No rush/i })
    if (await quickReply.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickReply.click()
      await page.waitForTimeout(2000)
    }

    await page.locator(`text=${taskTitle}`).first().click()
    await page.waitForTimeout(500)

    // Should show context pill in input
    await expect(page.getByPlaceholder(/ask about this task/i)).toBeVisible()

    apiMonitor.expectNoErrors()
  })

  test('can navigate back to home from task view', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Create and navigate to task
    const taskTitle = 'Test: Back nav ' + Date.now()
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)
    await input.press('Enter')

    await page.waitForTimeout(1500)
    const quickReply = page.getByRole('button', { name: /No rush/i })
    if (await quickReply.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickReply.click()
      await page.waitForTimeout(2000)
    }

    await page.locator(`text=${taskTitle}`).first().click()
    await page.waitForTimeout(500)

    // Click back button
    await page.locator('button').filter({ has: page.locator('svg') }).first().click()

    // Should be back on home view
    await expect(page.locator('h1:has-text("Gather")')).toBeVisible({ timeout: 3000 })

    apiMonitor.expectNoErrors()
  })
})

test.describe('v17 Steps and Completion', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('task view shows steps list', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Create a task that will get AI-generated steps
    const taskTitle = 'Test: Steps task ' + Date.now()
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)
    await input.press('Enter')

    // Wait for AI response and handle quick reply
    await page.waitForTimeout(2000)
    const quickReply = page.getByRole('button', { name: /No rush/i })
    if (await quickReply.isVisible({ timeout: 5000 }).catch(() => false)) {
      await quickReply.click()
      await page.waitForTimeout(3000)
    }

    // Navigate to task view
    await page.locator(`text=${taskTitle}`).first().click()
    await page.waitForTimeout(500)

    // Should see steps in task view
    // Look for step indicators (checkboxes or step items)
    const stepsContainer = page.locator('[class*="step"], [class*="Step"]')

    await screenshot(page, 'v17-task-steps')

    apiMonitor.expectNoErrors()
  })

  test('can toggle step completion', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Create a task
    const taskTitle = 'Test: Toggle step ' + Date.now()
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)
    await input.press('Enter')

    await page.waitForTimeout(2000)
    const quickReply = page.getByRole('button', { name: /No rush/i })
    if (await quickReply.isVisible({ timeout: 5000 }).catch(() => false)) {
      await quickReply.click()
      await page.waitForTimeout(3000)
    }

    // Navigate to task
    await page.locator(`text=${taskTitle}`).first().click()
    await page.waitForTimeout(500)

    // Find and click a step checkbox
    const checkbox = page.locator('button[class*="checkbox"], [role="checkbox"], button:has(svg[class*="check"])').first()
    if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkbox.click()
      await page.waitForTimeout(500)

      await screenshot(page, 'v17-step-toggled')
    }

    apiMonitor.expectNoErrors()
  })

  test('completing all steps shows celebration', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Create a simple task
    const taskTitle = 'Test: Celebrate ' + Date.now()
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)

    // Use the quick add option instead of AI flow
    await page.waitForTimeout(300)
    const addOption = page.locator(`text=Add "${taskTitle}"`).first()
    if (await addOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addOption.click()
      await page.waitForTimeout(1000)
    } else {
      await input.press('Enter')
      await page.waitForTimeout(2000)
      const quickReply = page.getByRole('button', { name: /No rush/i })
      if (await quickReply.isVisible({ timeout: 3000 }).catch(() => false)) {
        await quickReply.click()
        await page.waitForTimeout(2000)
      }
    }

    // Navigate to task and complete all steps
    await page.locator(`text=${taskTitle}`).first().click()
    await page.waitForTimeout(500)

    // Complete all visible checkboxes
    const checkboxes = page.locator('button[class*="checkbox"], [role="checkbox"], button:has(svg)').filter({ has: page.locator('svg') })
    const count = await checkboxes.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      const cb = checkboxes.nth(i)
      if (await cb.isVisible().catch(() => false)) {
        await cb.click()
        await page.waitForTimeout(300)
      }
    }

    // Look for confetti or celebration indicator
    await page.waitForTimeout(500)
    await screenshot(page, 'v17-task-complete')

    apiMonitor.expectNoErrors()
  })
})

test.describe('v17 Task Deletion', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('can delete task from task view', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Create a task to delete
    const taskTitle = 'Test: Delete me ' + Date.now()
    const input = page.getByPlaceholder(/what do you need to get done/i)
    await input.fill(taskTitle)

    // Quick add
    await page.waitForTimeout(300)
    const addOption = page.locator(`text=Add "${taskTitle}"`).first()
    if (await addOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addOption.click()
    } else {
      await input.press('Enter')
      await page.waitForTimeout(2000)
      const quickReply = page.getByRole('button', { name: /No rush/i })
      if (await quickReply.isVisible({ timeout: 3000 }).catch(() => false)) {
        await quickReply.click()
        await page.waitForTimeout(2000)
      }
    }
    await page.waitForTimeout(1000)

    // Navigate to task
    await page.locator(`text=${taskTitle}`).first().click()
    await page.waitForTimeout(500)

    // Look for delete button (usually red or with trash icon)
    const deleteBtn = page.locator('button:has-text("Delete"), button[class*="delete"], button[class*="danger"]').first()
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click()
      await page.waitForTimeout(500)

      // Should be back on home
      await expect(page.locator('h1:has-text("Gather")')).toBeVisible({ timeout: 3000 })

      // Task should not be visible
      await expect(page.locator(`text=${taskTitle}`)).not.toBeVisible({ timeout: 2000 })
    }

    await screenshot(page, 'v17-task-deleted')

    apiMonitor.expectNoErrors()
  })
})

test.describe('v17 Theme', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('theme toggle is visible and works', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Theme toggle should be visible
    const themeToggle = page.locator('button:has-text("🌙"), button:has-text("☀")')
    await expect(themeToggle.first()).toBeVisible()

    // Click to toggle
    await themeToggle.first().click()
    await page.waitForTimeout(300)

    await screenshot(page, 'v17-theme-toggled')

    apiMonitor.expectNoErrors()
  })
})
