import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/')

    // Should show the Gather branding
    await expect(page.locator('h1:has-text("Gather")')).toBeVisible()

    // Should show the tagline
    await expect(page.locator('text=Dump it here')).toBeVisible()

    // Should show Google sign-in button
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()

    // Should show demo option
    await expect(page.getByRole('button', { name: /try the demo/i })).toBeVisible()
  })

  test('can enter demo mode', async ({ page }) => {
    await page.goto('/')

    // Skip onboarding for faster test
    await page.evaluate(() => {
      localStorage.setItem('gather-onboarding-complete', 'true')
    })

    await page.getByRole('button', { name: /try the demo/i }).click()

    // Demo mode goes directly into the app with the Gather header
    await expect(page.locator('h1:has-text("Gather")')).toBeVisible()
    // Shows Exit demo button instead of Sign out
    await expect(page.getByRole('button', { name: 'Exit demo' })).toBeVisible()
  })

  test('can exit demo mode', async ({ page }) => {
    await page.goto('/')

    // Skip onboarding for faster test
    await page.evaluate(() => {
      localStorage.setItem('gather-onboarding-complete', 'true')
    })

    // Enter demo mode
    await page.getByRole('button', { name: /try the demo/i }).click()
    await expect(page.getByRole('button', { name: 'Exit demo' })).toBeVisible()

    // Exit demo mode
    await page.getByRole('button', { name: 'Exit demo' }).click()

    // Should return to login page
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('displays feature list on login page', async ({ page }) => {
    await page.goto('/')

    // Verify feature highlights are shown
    await expect(page.locator('text=AI breaks down overwhelming tasks')).toBeVisible()
    await expect(page.locator('text=No judgment, just progress')).toBeVisible()
  })
})
