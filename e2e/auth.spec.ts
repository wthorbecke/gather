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
    await expect(page.getByRole('button', { name: /try demo/i })).toBeVisible()
  })

  test('can enter demo mode', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /try demo/i }).click()

    // Should show the main app (default is Tasks tab now)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    // Should show the tabs
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Soul' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Money' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Space' })).toBeVisible()
  })

  test('can exit demo mode via sign in link', async ({ page }) => {
    await page.goto('/')

    // Enter demo mode
    await page.getByRole('button', { name: /try demo/i }).click()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    // Click sign in to exit demo
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should return to login page
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('displays feature list on login page', async ({ page }) => {
    await page.goto('/')

    // Verify feature highlights are shown
    await expect(page.locator('text=AI breaks down overwhelming tasks')).toBeVisible()
    await expect(page.locator('text=Ongoing collaboration when you get stuck')).toBeVisible()
    await expect(page.locator('text=No judgment, no guilt')).toBeVisible()
  })
})
