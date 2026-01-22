import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, screenshot } from './helpers'

test.describe('Soul Panel', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    await navigateToTab(page, 'Soul')
  })

  test('displays soul activities', async ({ page }) => {
    // Should show the default soul activities
    await expect(page.locator('text=Call someone you love')).toBeVisible()
    await expect(page.locator('text=Go outside')).toBeVisible()
    await expect(page.locator('text=Make something')).toBeVisible()
  })

  test('displays activity icons', async ({ page }) => {
    await screenshot(page, 'soul-panel')

    // Activities should have emoji icons
    await expect(page.locator('text=📞')).toBeVisible()
    await expect(page.locator('text=🚶')).toBeVisible()
    await expect(page.locator('text=🎨')).toBeVisible()
  })

  test('can interact with soul activities', async ({ page }) => {
    // Click on an activity
    const callActivity = page.locator('text=Call someone you love').locator('..')
    await callActivity.click()

    await screenshot(page, 'soul-activity-clicked')
  })

  test('soul panel has meaningful content', async ({ page }) => {
    // The soul panel should convey mindfulness/wellness
    await screenshot(page, 'soul-panel-full')

    // Verify all activities are present
    const activities = ['Call someone you love', 'Go outside', 'Make something']
    for (const activity of activities) {
      await expect(page.locator(`text=${activity}`)).toBeVisible()
    }
  })

  test('activities have visual styling', async ({ page }) => {
    // Activities should have colored backgrounds or icons
    await screenshot(page, 'soul-activities-styled')

    // The activities should be visually distinct
    const activityItems = page.locator('[class*="soul"], [class*="activity"]')
    await screenshot(page, 'soul-items')
  })
})
