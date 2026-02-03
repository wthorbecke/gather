import { test, expect } from '@playwright/test'

// Custom enterDemoMode that clears mood-related storage first
async function enterDemoModeWithClearMood(page: import('@playwright/test').Page) {
  await page.goto('/')

  // Set onboarding complete flag AND clear mood storage FIRST, before page loads
  await page.evaluate(() => {
    localStorage.setItem('gather-onboarding-complete', 'true')
    sessionStorage.clear()
    localStorage.removeItem('gather:mood_entries')
  })

  // Reload to ensure the storage changes take effect
  await page.reload()

  // Wait for the demo button to be visible (handles auth loading)
  await page.getByRole('button', { name: /try the demo/i }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByRole('button', { name: /try the demo/i }).click()

  // Wait for the app to load - look for the main app content
  await page.waitForTimeout(1500)
}

test.describe('Mood Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test via goto
    await page.goto('/')
    await page.evaluate(() => {
      sessionStorage.clear()
      localStorage.removeItem('gather:mood_entries')
      localStorage.setItem('gather-onboarding-complete', 'true')
    })
  })

  test('shows mood picker on first session', async ({ page }) => {
    await enterDemoModeWithClearMood(page)

    // Wait for the app to load and mood picker to appear
    await page.waitForTimeout(500)

    // Check for mood picker presence
    const moodPicker = page.locator('text=How are you feeling right now?')
    await expect(moodPicker).toBeVisible()

    // Verify all 5 mood emojis are present
    const emojis = ['😤', '😕', '😐', '🙂', '😊']
    for (const emoji of emojis) {
      await expect(page.locator(`text=${emoji}`)).toBeVisible()
    }
  })

  test('can select a mood and it disappears', async ({ page }) => {
    await enterDemoModeWithClearMood(page)

    // Wait for mood picker
    await page.waitForTimeout(500)
    const moodPicker = page.locator('text=How are you feeling right now?')
    await expect(moodPicker).toBeVisible()

    // Click on the "good" mood emoji (🙂)
    const goodMood = page.getByRole('button', { name: 'good' })
    await goodMood.click()

    // Wait for animation to complete
    await page.waitForTimeout(500)

    // Mood picker should no longer be visible
    await expect(moodPicker).not.toBeVisible()
  })

  test('can dismiss mood picker', async ({ page }) => {
    await enterDemoModeWithClearMood(page)

    // Wait for mood picker
    await page.waitForTimeout(500)
    const moodPicker = page.locator('text=How are you feeling right now?')
    await expect(moodPicker).toBeVisible()

    // Click the dismiss button (X)
    const dismissButton = page.getByRole('button', { name: 'Dismiss' })
    await dismissButton.click()

    // Wait for animation
    await page.waitForTimeout(300)

    // Mood picker should be gone
    await expect(moodPicker).not.toBeVisible()
  })

  test('mood picker does not reappear in same session', async ({ page }) => {
    await enterDemoModeWithClearMood(page)

    // Wait for and dismiss mood picker
    await page.waitForTimeout(500)
    const moodPicker = page.locator('text=How are you feeling right now?')
    await expect(moodPicker).toBeVisible()

    // Click on any mood
    const okayMood = page.getByRole('button', { name: 'okay' })
    await okayMood.click()
    await page.waitForTimeout(500)

    // Navigate away (e.g., click a task) and come back
    const anyTask = page.locator('[data-testid="task-item"]').first()
    if (await anyTask.isVisible()) {
      await anyTask.click()
      await page.waitForTimeout(300)

      // Go back
      const backButton = page.getByRole('button', { name: /back/i })
      if (await backButton.isVisible()) {
        await backButton.click()
        await page.waitForTimeout(300)
      }
    }

    // Mood picker should still not be visible
    await expect(moodPicker).not.toBeVisible()
  })

  test('mood selection stores data in localStorage', async ({ page }) => {
    await enterDemoModeWithClearMood(page)

    // Wait for mood picker
    await page.waitForTimeout(500)
    const moodPicker = page.locator('text=How are you feeling right now?')
    await expect(moodPicker).toBeVisible()

    // Select "great" mood (exact match to avoid matching "not great")
    const greatMood = page.getByRole('button', { name: 'great', exact: true })
    await greatMood.click()
    await page.waitForTimeout(500)

    // Check localStorage for mood entry
    const moodEntries = await page.evaluate(() => {
      const data = localStorage.getItem('gather:mood_entries')
      return data ? JSON.parse(data) : []
    })

    expect(moodEntries).toHaveLength(1)
    expect(moodEntries[0].mood).toBe(5) // "great" = 5
    expect(moodEntries[0].timestamp).toBeTruthy()
  })
})
