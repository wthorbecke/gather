import { test, expect } from '@playwright/test'
import { enterDemoMode, setupApiErrorMonitoring } from './helpers'

/**
 * API Error Monitoring Tests
 * These tests verify that API errors are properly caught and surfaced
 */

test.describe('API Error Monitoring', () => {
  test('demo mode should have no API errors on initial load', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await enterDemoMode(page)
    
    // Wait for the page to fully load
    await page.waitForSelector('text=Gather', { timeout: 5000 })
    await page.waitForTimeout(500)
    
    // This will fail the test if any PostgREST errors occurred
    apiMonitor.expectNoErrors()
  })

  test.skip('task interactions should have no API errors', async ({ page }) => {
    // Skipped: v17 demo mode doesn't show the full app UI
    // This test requires authenticated mode to work
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await enterDemoMode(page)
    
    // Add a task using the v17 unified input
    const quickInput = page.getByPlaceholder(/what do you need to get done/i)
    await quickInput.fill('Test task for API monitoring')
    await quickInput.press('Enter')
    await page.waitForTimeout(500)
    
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
