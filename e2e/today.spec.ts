import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, screenshot } from './helpers'

test.describe('Today Panel (Habits)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    // Navigate to Today tab (Tasks is now the default)
    await navigateToTab(page, 'Today')
  })

  test('displays habits panel', async ({ page }) => {
    // Should show the Today panel content
    await expect(page.locator('text=Make bed')).toBeVisible()
  })

  test('displays demo habits on load', async ({ page }) => {
    // Should show morning habits
    await expect(page.locator('text=Make bed')).toBeVisible()
    await expect(page.locator('text=Drink water')).toBeVisible()

    // Should show games habit
    await expect(page.locator('text=Wordle')).toBeVisible()

    // Should show optional habit
    await expect(page.locator('text=Read for 10 min')).toBeVisible()
  })

  test('shows habit sections', async ({ page }) => {
    // Look for section headers
    await expect(page.locator('text=Morning')).toBeVisible()
    await expect(page.locator('text=Daily play')).toBeVisible()
    await expect(page.locator('text=When you can')).toBeVisible()

    await screenshot(page, 'today-panel-categories')
  })

  test('can toggle habit completion', async ({ page }) => {
    // Find the "Make bed" habit (starts checked in demo)
    const makeBedItem = page.locator('text=Make bed').locator('..')
    
    // Click to toggle
    await makeBedItem.click()
    await screenshot(page, 'after-toggle-habit')
  })

  test('Wordle habit has external link', async ({ page }) => {
    // The Wordle habit should have a link
    await expect(page.locator('text=Wordle')).toBeVisible()
    await expect(page.locator('a:has-text("play")')).toBeVisible()

    await screenshot(page, 'wordle-habit')
  })

  test('habits persist state during session', async ({ page }) => {
    // Toggle a habit by clicking on it
    const drinkWaterItem = page.locator('text=Drink water').locator('..')
    await drinkWaterItem.click()

    // Navigate away and back
    await navigateToTab(page, 'Tasks')
    await navigateToTab(page, 'Today')

    // State should be preserved (in demo mode this works via local state)
    await screenshot(page, 'habits-after-navigation')
  })

  test('displays habit sections correctly', async ({ page }) => {
    // Take a screenshot to verify the layout
    await screenshot(page, 'today-panel-full')

    // Verify habits are visible
    await expect(page.locator('text=Make bed')).toBeVisible()
    await expect(page.locator('text=Drink water')).toBeVisible()
    await expect(page.locator('text=Wordle')).toBeVisible()
    await expect(page.locator('text=Read for 10 min')).toBeVisible()
  })

  test('shows daily quote', async ({ page }) => {
    // The Today panel should show a motivational quote
    // Look for quote attribution marker
    await expect(page.locator('[class*="italic"]')).toBeVisible()
  })
})
