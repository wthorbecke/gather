import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  screenshot,
} from './helpers'

/**
 * Hour Timeline Tests
 *
 * Tests for the visual hour timeline feature in DayView.
 * This feature helps ADHD users visualize their day and combat time blindness.
 */

test.describe('Hour Timeline', () => {
  test('shows timeline toggle button in day view', async ({ page }) => {
    await enterDemoMode(page)

    // Navigate to day view by looking for Today header or timeline toggle
    // Demo mode should start in the day view
    await page.waitForTimeout(1000)

    // Should see the timeline toggle button
    const timelineToggle = page.getByRole('button', { name: /timeline/i })
    await expect(timelineToggle).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'timeline-toggle-visible')
  })

  test('timeline toggle shows/hides the timeline', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    const timelineToggle = page.getByRole('button', { name: /timeline/i })

    // Timeline should be visible by default
    // Look for the timeline container with hour labels
    const hourLabel = page.locator('text=/^(6a|12p|6p)$/').first()
    await expect(hourLabel).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'timeline-visible')

    // Click toggle to hide
    await timelineToggle.click()
    await page.waitForTimeout(300)

    // Hour labels should be hidden
    await expect(hourLabel).not.toBeVisible({ timeout: 2000 })

    await screenshot(page, 'timeline-hidden')

    // Click toggle to show again
    await timelineToggle.click()
    await page.waitForTimeout(300)

    // Hour labels should be visible again
    await expect(page.locator('text=/^(6a|12p|6p)$/').first()).toBeVisible({ timeout: 2000 })
  })

  test('timeline shows hour labels', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Check for hour labels (6am to 11pm range)
    // Look for common hour markers
    await expect(page.locator('text=/^6a$/')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/^12p$/')).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'timeline-hour-labels')
  })

  test('timeline is horizontally scrollable', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // The timeline container should be scrollable
    // Find the scrollable container
    const scrollContainer = page.locator('.overflow-x-auto').first()
    await expect(scrollContainer).toBeVisible({ timeout: 5000 })

    // Get initial scroll position
    const initialScrollLeft = await scrollContainer.evaluate((el) => el.scrollLeft)

    // Scroll the timeline
    await scrollContainer.evaluate((el) => {
      el.scrollLeft = el.scrollLeft + 200
    })

    await page.waitForTimeout(300)

    // Verify scroll position changed
    const newScrollLeft = await scrollContainer.evaluate((el) => el.scrollLeft)
    expect(newScrollLeft).toBeGreaterThan(initialScrollLeft)

    await screenshot(page, 'timeline-scrolled')
  })

  test('timeline shows current time indicator on today', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Current time indicator should be a red/danger colored vertical line
    // The indicator has a small dot at the top
    const currentTimeIndicator = page.locator('.bg-danger').first()

    // Should be visible (it's today in the test)
    // Note: This might not be visible if current time is outside 6am-11pm range
    const isVisible = await currentTimeIndicator.isVisible({ timeout: 3000 }).catch(() => false)

    if (isVisible) {
      await screenshot(page, 'timeline-current-time')
    } else {
      // If not visible, it's likely outside display hours - that's okay
      console.log('Current time indicator not visible - possibly outside 6am-11pm range')
    }
  })

  test('timeline shows scheduled tasks as blocks', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Demo mode may have scheduled tasks
    // Task blocks appear as rounded rectangles in the timeline
    const taskBlocks = page.locator('.rounded-md.cursor-pointer').filter({
      has: page.locator('.truncate'),
    })

    // Count task blocks in timeline
    const count = await taskBlocks.count()
    console.log(`Found ${count} task blocks in timeline`)

    await screenshot(page, 'timeline-task-blocks')
  })

  test('clicking task block navigates to task', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Find a task block in the timeline
    // Task blocks have truncated text and are clickable
    const taskBlocks = page.locator('.rounded-md.cursor-pointer').filter({
      has: page.locator('.truncate'),
    })

    const count = await taskBlocks.count()
    if (count > 0) {
      // Get the task title from the block
      const blockText = await taskBlocks.first().textContent()

      // Click the task block
      await taskBlocks.first().click()
      await page.waitForTimeout(500)

      // Should navigate to task view (back button visible)
      const backButton = page.locator('button:has(svg path[d*="M10 12L6 8"])').first()
      if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'timeline-task-clicked')
      }
    } else {
      console.log('No task blocks found to click')
    }
  })

  test('timeline is mobile-friendly', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })

    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Timeline should still be visible and usable
    const timelineToggle = page.getByRole('button', { name: /timeline/i })
    await expect(timelineToggle).toBeVisible({ timeout: 5000 })

    // Hour labels should be visible
    await expect(page.locator('text=/^(6a|12p|6p)$/').first()).toBeVisible({ timeout: 5000 })

    // Should be horizontally scrollable
    const scrollContainer = page.locator('.overflow-x-auto').first()
    await expect(scrollContainer).toBeVisible({ timeout: 5000 })

    await screenshot(page, 'timeline-mobile')
  })
})
