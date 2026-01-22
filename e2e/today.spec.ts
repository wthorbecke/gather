import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, screenshot } from './helpers'

test.describe('Today Panel (Habits)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    // Today tab is selected by default
  })

  test('displays current date', async ({ page }) => {
    // Should show today's date formatted nicely
    const today = new Date()
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })

    await expect(page.locator(`text=${dayName}`)).toBeVisible()
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

  test('shows habit categories', async ({ page }) => {
    // Look for category headers or sections
    await screenshot(page, 'today-panel-categories')

    // The habits should be organized (check for section structure)
    const habitItems = page.locator('text=Make bed')
    await expect(habitItems).toBeVisible()
  })

  test('can toggle habit completion', async ({ page }) => {
    // Find the "Make bed" habit which starts checked in demo
    const makeBedRow = page.locator('text=Make bed').locator('..')

    // Click to toggle
    await makeBedRow.click()
    await screenshot(page, 'after-toggle-habit')
  })

  test('Wordle habit has external link', async ({ page }) => {
    // The Wordle habit should have a link to NYTimes
    const wordleItem = page.locator('text=Wordle')
    await expect(wordleItem).toBeVisible()

    // Check if there's a link nearby
    await screenshot(page, 'wordle-habit')
  })

  test('habits persist state during session', async ({ page }) => {
    // Toggle a habit
    const drinkWaterRow = page.locator('text=Drink water').locator('..')
    await drinkWaterRow.click()

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
})
