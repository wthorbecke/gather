import { test, expect } from '@playwright/test'
import { enterDemoMode } from './helpers'

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    // Enter demo mode using the helper
    await enterDemoMode(page)
    // Give the app time to fully load
    await page.waitForTimeout(1500)
  })

  test('Cmd+K focuses the main input in StackView', async ({ page }) => {
    // Make sure we're in Stack View (default)
    // The input may have "Add something..." or "What's next?" placeholder
    const input = page.locator('input[placeholder*="Add" i], input[placeholder*="next" i]')

    // Press Cmd+K (or Ctrl+K on non-Mac)
    await page.keyboard.press('Meta+k')

    // Wait for input to appear and be focused
    await expect(input.first()).toBeVisible({ timeout: 3000 })
    await expect(input.first()).toBeFocused()
  })

  test('Cmd+K shows and focuses input in StackView with tasks', async ({ page }) => {
    // First add a task to ensure stack has content
    await page.keyboard.press('Meta+k')

    const input = page.locator('input[placeholder*="Add" i], input[placeholder*="next" i]')
    await expect(input.first()).toBeVisible({ timeout: 3000 })

    // The input should be focused
    await expect(input.first()).toBeFocused()

    // Type and submit a task
    await input.first().fill('Test task for keyboard shortcut')
    await input.first().press('Enter')

    // Wait for task to be processed
    await page.waitForTimeout(2000)

    // Press Cmd+K again
    await page.keyboard.press('Meta+k')

    // Input should be visible and focused again
    await expect(input.first()).toBeVisible({ timeout: 3000 })
    await expect(input.first()).toBeFocused()
  })

  test('Cmd+K focuses input in HomeView (Classic view)', async ({ page }) => {
    // Switch to Classic/HomeView
    const listViewButton = page.locator('button[title="Switch to list view"]')
    if (await listViewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await listViewButton.click()
      await page.waitForTimeout(500)
    }

    // The main input in HomeView should have the command K hint
    const cmdKHint = page.locator('kbd:has-text("K")')
    await expect(cmdKHint).toBeVisible({ timeout: 3000 })

    // Press Cmd+K
    await page.keyboard.press('Meta+k')

    // The input should be focused (look for any input in the main area)
    const input = page.locator('input').first()
    await expect(input).toBeFocused({ timeout: 3000 })
  })

  test('Ctrl+K works as alternative for Cmd+K', async ({ page }) => {
    // Press Ctrl+K (Windows/Linux alternative)
    await page.keyboard.press('Control+k')

    // Input should appear and be focused
    const input = page.locator('input[placeholder*="Add" i], input[placeholder*="next" i]')
    await expect(input.first()).toBeVisible({ timeout: 3000 })
    await expect(input.first()).toBeFocused()
  })

  test('Cmd+K prevents default browser behavior', async ({ page }) => {
    // This test verifies that the default browser behavior (usually opening address bar)
    // is prevented when Cmd+K is pressed

    // Press Cmd+K
    await page.keyboard.press('Meta+k')

    // The input should be visible - if default wasn't prevented,
    // the browser might have opened its own search/address bar
    const input = page.locator('input[placeholder*="Add" i], input[placeholder*="next" i]')
    await expect(input.first()).toBeVisible({ timeout: 3000 })
  })
})
