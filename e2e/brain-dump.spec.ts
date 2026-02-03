import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  screenshot,
} from './helpers'

/**
 * Brain Dump Feature Tests
 *
 * Tests for the /dump command and BrainDumpModal component
 * that allows users to capture freeform thoughts and extract tasks.
 *
 * Uses demo mode which doesn't require authentication.
 */

test.describe('Brain Dump Feature', () => {
  // Increase timeout for demo mode tests since they need to dismiss demo cards
  test.setTimeout(60000)

  test('keyboard shortcut D opens brain dump', async ({ page }) => {
    await enterDemoMode(page)

    // Click away from input to ensure not focused
    await page.locator('h1:has-text("Gather")').click()
    await page.waitForTimeout(100)

    // Press D key (not while focused on input)
    await page.keyboard.press('d')

    // Modal should open
    await expect(page.locator('h2:has-text("Brain Dump")')).toBeVisible()
  })

  test('keyboard shortcuts modal shows brain dump shortcuts', async ({ page }) => {
    await enterDemoMode(page)

    // Click away from input to ensure not focused
    await page.locator('h1:has-text("Gather")').click()
    await page.waitForTimeout(100)

    // Open keyboard shortcuts
    await page.keyboard.press('?')

    // Should show brain dump shortcuts (two entries: D key and /dump command)
    await expect(page.getByText('Brain dump - capture everything')).toBeVisible()
    await expect(page.getByText('/dump')).toBeVisible()

    await screenshot(page, 'keyboard-shortcuts-brain-dump')
  })

  test('/dump command opens brain dump modal', async ({ page }) => {
    await enterDemoMode(page)

    // Wait for app to stabilize and find any textbox (input field)
    await page.waitForTimeout(500)
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })

    // Type /dump command
    await input.fill('/dump')
    await input.press('Enter')

    // Modal should open
    await expect(page.locator('h2:has-text("Brain Dump")')).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder(/just dump everything here/i)).toBeVisible()

    await screenshot(page, 'brain-dump-modal-open')
  })

  test('brain dump modal has proper layout', async ({ page }) => {
    await enterDemoMode(page)

    // Wait for app to stabilize
    await page.waitForTimeout(500)
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('/dump')
    await input.press('Enter')

    // Check modal elements
    await expect(page.locator('h2:has-text("Brain Dump")')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/just dump everything here/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /process/i })).toBeVisible()

    // Process button should be disabled when textarea is empty
    await expect(page.getByRole('button', { name: /process/i })).toBeDisabled()
  })

  test('brain dump modal can be closed', async ({ page }) => {
    await enterDemoMode(page)

    // Wait for app to stabilize
    await page.waitForTimeout(500)
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('/dump')
    await input.press('Enter')

    await expect(page.locator('h2:has-text("Brain Dump")')).toBeVisible({ timeout: 5000 })

    // Close by clicking on close button
    await page.locator('[aria-label="Close"]').first().click()

    // Wait for modal to close (animation)
    await page.waitForTimeout(400)

    // Modal should be gone
    await expect(page.locator('h2:has-text("Brain Dump")')).not.toBeVisible()
  })

  test('brain dump textarea accepts input', async ({ page }) => {
    await enterDemoMode(page)

    // Wait for app to stabilize
    await page.waitForTimeout(500)
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('/dump')
    await input.press('Enter')

    // Wait for modal to appear
    await expect(page.locator('h2:has-text("Brain Dump")')).toBeVisible({ timeout: 5000 })

    // Type in textarea
    const textarea = page.getByPlaceholder(/just dump everything here/i)
    await textarea.fill('call mom, buy groceries, schedule dentist')

    // Process button should now be enabled
    await expect(page.getByRole('button', { name: /process/i })).toBeEnabled()

    // Character count should show
    await expect(page.getByText(/\d+ characters/)).toBeVisible()

    await screenshot(page, 'brain-dump-with-text')
  })
})
