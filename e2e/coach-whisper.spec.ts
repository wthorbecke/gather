import { test, expect } from '@playwright/test'
import { enterDemoMode } from './helpers'

test.describe('Coach Whisper', () => {
  test('whisper appears after completing a step', async ({ page }) => {
    // Set up session storage BEFORE entering demo mode
    await page.goto('/')
    await page.evaluate(() => {
      sessionStorage.clear()
      localStorage.setItem('gather-onboarding-complete', 'true')
      // Pre-set activity so whisper shows when we enter demo
      const activity = {
        completions: 1,
        lastCompletionTime: Date.now(),
        morningCompletions: 0,
        taskCompletedTitles: [],
      }
      sessionStorage.setItem('gather:whisper-activity', JSON.stringify(activity))
    })
    await enterDemoMode(page)

    // Wait for the home view to load with tasks
    await expect(page.locator('text=Do this now')).toBeVisible({ timeout: 10000 })

    // Wait for whisper delay (500ms) + animation
    await page.waitForTimeout(1500)

    // Check if whisper is visible - it shows "first one done. that's the hardest part."
    const whisper = page.locator('[role="status"]')
    await expect(whisper).toBeVisible({ timeout: 5000 })
    await expect(whisper).toHaveClass(/text-xs/)
    await expect(whisper).toHaveClass(/italic/)
  })

  test('whisper auto-dismisses after 10 seconds', async ({ page }) => {
    // Set up session storage
    await page.goto('/')
    await page.evaluate(() => {
      sessionStorage.clear()
      localStorage.setItem('gather-onboarding-complete', 'true')
      const activity = {
        completions: 1,
        lastCompletionTime: Date.now(),
        morningCompletions: 0,
        taskCompletedTitles: [],
      }
      sessionStorage.setItem('gather:whisper-activity', JSON.stringify(activity))
    })
    await enterDemoMode(page)

    // Wait for home view
    await expect(page.locator('text=Do this now')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1500)

    // Whisper should be visible initially
    const whisper = page.locator('[role="status"]')
    await expect(whisper).toBeVisible({ timeout: 5000 })

    // Wait for auto-dismiss (10 seconds)
    await page.waitForTimeout(11000)

    // Whisper should be gone
    await expect(whisper).not.toBeVisible()
  })

  test('whisper dismisses on user interaction', async ({ page }) => {
    // Set up session storage
    await page.goto('/')
    await page.evaluate(() => {
      sessionStorage.clear()
      localStorage.setItem('gather-onboarding-complete', 'true')
      const activity = {
        completions: 1,
        lastCompletionTime: Date.now(),
        morningCompletions: 0,
        taskCompletedTitles: [],
      }
      sessionStorage.setItem('gather:whisper-activity', JSON.stringify(activity))
    })
    await enterDemoMode(page)

    // Wait for home view
    await expect(page.locator('text=Do this now')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1500)

    // Whisper should be visible
    const whisper = page.locator('[role="status"]')
    await expect(whisper).toBeVisible({ timeout: 5000 })

    // Click anywhere to dismiss
    await page.click('body')

    // Whisper should be gone
    await expect(whisper).not.toBeVisible()
  })

  test('only shows one whisper per session', async ({ page }) => {
    // Set up session storage with whisper already shown
    await page.goto('/')
    await page.evaluate(() => {
      sessionStorage.clear()
      localStorage.setItem('gather-onboarding-complete', 'true')
      const activity = {
        completions: 3,
        lastCompletionTime: Date.now(),
        morningCompletions: 0,
        taskCompletedTitles: [],
      }
      sessionStorage.setItem('gather:whisper-activity', JSON.stringify(activity))
      sessionStorage.setItem('gather:whisper-shown', 'true')
    })
    await enterDemoMode(page)

    // Wait for home view
    await expect(page.locator('text=Do this now')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1500)

    // Whisper should NOT be visible since it was already shown
    const whisper = page.locator('[role="status"]')
    await expect(whisper).not.toBeVisible()
  })

  test('shows different message after 3 completions', async ({ page }) => {
    // Set up session storage with 3 completions
    await page.goto('/')
    await page.evaluate(() => {
      sessionStorage.clear()
      localStorage.setItem('gather-onboarding-complete', 'true')
      const activity = {
        completions: 3,
        lastCompletionTime: Date.now(),
        morningCompletions: 0,
        taskCompletedTitles: [],
      }
      sessionStorage.setItem('gather:whisper-activity', JSON.stringify(activity))
    })
    await enterDemoMode(page)

    // Wait for home view
    await expect(page.locator('text=Do this now')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1500)

    // Whisper should show the "three down" message
    const whisper = page.locator('[role="status"]')
    await expect(whisper).toBeVisible({ timeout: 5000 })
    await expect(whisper).toContainText('three down')
  })
})
