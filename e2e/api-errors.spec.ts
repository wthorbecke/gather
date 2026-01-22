import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, setupApiErrorMonitoring } from './helpers'

/**
 * API Error Monitoring Tests
 * These tests verify that API errors are properly caught and surfaced
 */

test.describe('API Error Monitoring', () => {
  test('demo mode should have no API errors on initial load', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await enterDemoMode(page)
    
    // Navigate through all tabs to trigger any API calls
    await navigateToTab(page, 'Tasks')
    await navigateToTab(page, 'Soul')
    await navigateToTab(page, 'Money')
    await navigateToTab(page, 'Space')
    await navigateToTab(page, 'Today')
    
    // This will fail the test if any PostgREST errors occurred
    apiMonitor.expectNoErrors()
  })

  test('task interactions should have no API errors', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await enterDemoMode(page)
    await navigateToTab(page, 'Tasks')
    
    // Add a task
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Test task for API monitoring')
    await quickInput.press('Enter')
    await page.waitForTimeout(500)
    
    // Handle breakdown modal if it appears
    const breakdownModal = page.locator('text=That sounds like a big one')
    if (await breakdownModal.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.getByRole('button', { name: /just add it as is/i }).click()
    }
    
    apiMonitor.expectNoErrors()
  })

  test('habit interactions should have no API errors', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await enterDemoMode(page)
    await navigateToTab(page, 'Today')
    
    // Try to interact with a habit if visible
    const habitCheckbox = page.locator('[data-testid="habit-checkbox"]').first()
    if (await habitCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await habitCheckbox.click()
      await page.waitForTimeout(300)
    }
    
    apiMonitor.expectNoErrors()
  })
})

test.describe('API Error Detection - Authenticated', () => {
  // These tests require a real Supabase connection to catch actual API errors
  // They will be most useful when testing authenticated flows
  
  test.skip('placeholder for authenticated API error tests', async () => {
    // TODO: Add tests that verify API errors are caught during:
    // - Task creation/update with missing columns
    // - Habit logging with schema mismatches  
    // - Profile fetching with missing user data
    // These require TEST_SUPABASE_URL to be set
  })
})
