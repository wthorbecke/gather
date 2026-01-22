import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, screenshot } from './helpers'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('Today tab is selected by default', async ({ page }) => {
    // Today tab should be active
    const todayTab = page.getByRole('button', { name: 'Today' })
    await expect(todayTab).toBeVisible()

    // Should show habits content
    await expect(page.locator('text=Make bed')).toBeVisible()
  })

  test('can navigate to all tabs', async ({ page }) => {
    // Navigate to Soul
    await navigateToTab(page, 'Soul')
    await expect(page.locator('text=Call someone you love')).toBeVisible()

    // Navigate to Tasks
    await navigateToTab(page, 'Tasks')
    await expect(page.locator('text=Reply to Mom')).toBeVisible()

    // Navigate to Money
    await navigateToTab(page, 'Money')
    await screenshot(page, 'money-panel')

    // Navigate to Space
    await navigateToTab(page, 'Space')
    await screenshot(page, 'space-panel')

    // Navigate back to Today
    await navigateToTab(page, 'Today')
    await expect(page.locator('text=Make bed')).toBeVisible()
  })

  test('tabs are visually distinct when active', async ({ page }) => {
    // Take screenshots of different active tabs
    await screenshot(page, 'nav-today-active')

    await navigateToTab(page, 'Tasks')
    await screenshot(page, 'nav-tasks-active')

    await navigateToTab(page, 'Soul')
    await screenshot(page, 'nav-soul-active')
  })

  test('all tabs are visible', async ({ page }) => {
    const tabs = ['Today', 'Soul', 'Tasks', 'Money', 'Space']

    for (const tab of tabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible()
    }
  })

  test('tab state persists navigation', async ({ page }) => {
    // Make changes in Tasks
    await navigateToTab(page, 'Tasks')
    const initialTaskCount = await page.locator('text=Schedule dentist').count()

    // Navigate away
    await navigateToTab(page, 'Soul')
    await navigateToTab(page, 'Today')

    // Navigate back to Tasks
    await navigateToTab(page, 'Tasks')

    // Tasks should still be there
    await expect(page.locator('text=Schedule dentist appointment')).toBeVisible()
  })

  test('header shows app name', async ({ page }) => {
    await expect(page.locator('h1:has-text("Gather")')).toBeVisible()
  })

  test('header shows date', async ({ page }) => {
    const today = new Date()
    const monthName = today.toLocaleDateString('en-US', { month: 'long' })

    await expect(page.locator(`text=${monthName}`)).toBeVisible()
  })
})
