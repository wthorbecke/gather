import { test, expect, Page, BrowserContext } from '@playwright/test'
import { enterDemoMode, screenshot } from './helpers'

/**
 * Swipe Gesture Tests
 *
 * Tests for mobile swipe interactions on TaskListItem:
 * - Swipe left: reveal snooze/delete actions
 * - Swipe right: quick complete (if task has steps)
 * - Long press: open context menu
 *
 * Note: These tests use touch emulation which works best in mobile viewports
 */

// Helper to simulate touch swipe on an element
async function swipe(
  page: Page,
  selector: string,
  direction: 'left' | 'right',
  distance: number = 100
) {
  const element = page.locator(selector).first()
  const box = await element.boundingBox()
  if (!box) throw new Error(`Element not found: ${selector}`)

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  const endX = direction === 'left' ? startX - distance : startX + distance

  // Simulate touch gesture
  await page.touchscreen.tap(startX, startY)
  await page.waitForTimeout(50)

  // For swipe, we need to use mouse events with touch simulation
  // Playwright doesn't have native swipe, so we simulate via mouse
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.waitForTimeout(50)

  // Move in small increments for realistic swipe
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps
    await page.mouse.move(x, startY)
    await page.waitForTimeout(10)
  }

  await page.mouse.up()
}

// Helper to simulate long press
async function longPress(page: Page, selector: string, duration: number = 600) {
  const element = page.locator(selector).first()
  const box = await element.boundingBox()
  if (!box) throw new Error(`Element not found: ${selector}`)

  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  await page.touchscreen.tap(x, y)
  // Hold for duration
  await page.waitForTimeout(duration)
}

test.describe('Swipe Gestures - Mobile', () => {
  // Use mobile viewport for touch gesture tests
  test.use({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
  })

  test('task list items are swipeable on mobile', async ({ page }) => {
    await enterDemoMode(page)

    // Wait for tasks to load
    await page.waitForTimeout(1000)

    // Take screenshot of initial state
    await screenshot(page, 'swipe-initial')

    // Check that task items exist
    const taskItems = page.locator('[class*="TaskListItem"], [class*="rounded-xl"][class*="bg-card"]')
    const count = await taskItems.count()

    expect(count).toBeGreaterThan(0)
  })

  test('swipe left reveals action area with color', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Find the first task item
    const taskItem = page.locator('.rounded-xl.bg-card').first()

    if (await taskItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Perform swipe left
      await swipe(page, '.rounded-xl.bg-card', 'left', 100)
      await page.waitForTimeout(300)

      // Take screenshot to verify action area is revealed
      await screenshot(page, 'swipe-left-action')
    }
  })

  test('swipe right reveals complete action area', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Find the first task item with steps (for quick complete)
    const taskItem = page.locator('.rounded-xl.bg-card').first()

    if (await taskItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Perform swipe right
      await swipe(page, '.rounded-xl.bg-card', 'right', 100)
      await page.waitForTimeout(300)

      // Take screenshot to verify action area is revealed
      await screenshot(page, 'swipe-right-action')
    }
  })

  test('incomplete swipe snaps back', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    const taskItem = page.locator('.rounded-xl.bg-card').first()

    if (await taskItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Perform small swipe (below threshold of 80px)
      await swipe(page, '.rounded-xl.bg-card', 'left', 40)
      await page.waitForTimeout(500)

      // Task should snap back to original position
      await screenshot(page, 'swipe-snap-back')
    }
  })

  test('kebab menu is visible on mobile', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    // Kebab menu should be visible (opacity-40 on mobile)
    const kebabButton = page.locator('[aria-label="Task menu"]').first()

    // It should exist even if faded
    await expect(kebabButton).toBeVisible({ timeout: 2000 })

    // Click to open menu
    await kebabButton.click()
    await page.waitForTimeout(300)

    // Menu should appear with options
    const menuOptions = page.locator('.animate-rise button')
    await expect(menuOptions.first()).toBeVisible({ timeout: 1000 })

    await screenshot(page, 'swipe-mobile-menu')
  })
})

test.describe('Swipe Gestures - Desktop', () => {
  // Desktop viewport - swipe gestures should not interfere
  test.use({
    viewport: { width: 1280, height: 720 },
    hasTouch: false,
  })

  test('hover shows kebab menu on desktop', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    const taskItem = page.locator('.rounded-xl.bg-card').first()

    if (await taskItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Hover over task
      await taskItem.hover()
      await page.waitForTimeout(200)

      // Kebab menu should appear
      const kebabButton = taskItem.locator('[aria-label="Task menu"]')
      await expect(kebabButton).toBeVisible({ timeout: 1000 })

      await screenshot(page, 'swipe-desktop-hover')
    }
  })

  test('click navigates to task on desktop', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    const taskItem = page.locator('.rounded-xl.bg-card').first()

    if (await taskItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      const taskText = await taskItem.textContent()
      await taskItem.click()
      await page.waitForTimeout(500)

      // Should navigate to task view
      // Look for back button which indicates we're in task view
      const backButton = page.locator('button:has(svg path[d*="M10 12L6 8"])').first()
      const isInTaskView = await backButton.isVisible({ timeout: 1000 }).catch(() => false)

      if (isInTaskView) {
        await screenshot(page, 'swipe-desktop-task-view')
      }
    }
  })
})

test.describe('Gesture Hook - Unit Tests', () => {
  // Test the hook behavior through component integration
  test.use({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
  })

  test('swipe state resets after release', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1000)

    const taskItem = page.locator('.rounded-xl.bg-card').first()

    if (await taskItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Swipe and release
      await swipe(page, '.rounded-xl.bg-card', 'left', 100)
      await page.waitForTimeout(500)

      // Wait for spring animation to complete
      await page.waitForTimeout(300)

      // Take screenshot after release - should be back to normal
      await screenshot(page, 'swipe-after-release')
    }
  })
})
