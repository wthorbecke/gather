import { test, expect } from '@playwright/test'
import { getTestConfig, createTestSupabaseClient } from './helpers'

/**
 * Debug test to understand why authenticated app isn't loading properly
 */
test('debug authenticated session', async ({ page }) => {
  const config = getTestConfig()

  if (!config.isConfigured) {
    test.skip()
    return
  }

  // Listen to console errors
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // Listen to page errors
  const pageErrors: string[] = []
  page.on('pageerror', err => {
    pageErrors.push(err.message)
  })

  // Navigate to the app
  await page.goto('/')

  // Take screenshot of initial state (login page)
  await page.screenshot({ path: '.playwright-mcp/debug-1-login.png', fullPage: true })

  // Get the session via Supabase
  const supabase = createTestSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.testEmail!,
    password: config.testPassword!,
  })

  if (error) {
    console.error('Auth error:', error)
    throw error
  }

  console.log('Session obtained. User ID:', data.user?.id)

  // Inject the session into localStorage
  const storageKey = `sb-${new URL(config.supabaseUrl!).hostname.split('.')[0]}-auth-token`
  console.log('Storage key:', storageKey)

  await page.evaluate(({ key, session }) => {
    console.log('Setting localStorage key:', key)
    localStorage.setItem(key, JSON.stringify(session))

    // Also log current localStorage state
    console.log('LocalStorage keys:', Object.keys(localStorage))
  }, { key: storageKey, session: data.session })

  // Reload to pick up the session
  await page.reload()

  // Wait a bit for app to load
  await page.waitForTimeout(3000)

  // Take screenshot
  await page.screenshot({ path: '.playwright-mcp/debug-2-after-reload.png', fullPage: true })

  // Wait longer
  await page.waitForTimeout(5000)

  // Take another screenshot
  await page.screenshot({ path: '.playwright-mcp/debug-3-after-wait.png', fullPage: true })

  // Log any errors
  if (consoleErrors.length > 0) {
    console.log('Console errors:', consoleErrors)
  }
  if (pageErrors.length > 0) {
    console.log('Page errors:', pageErrors)
  }

  // Check for specific elements
  const hasInput = await page.locator('input').first().isVisible().catch(() => false)
  const hasButton = await page.locator('button').first().isVisible().catch(() => false)
  const htmlContent = await page.content()

  console.log('Has any input:', hasInput)
  console.log('Has any button:', hasButton)
  console.log('HTML length:', htmlContent.length)

  // Check if there's an error boundary or loading state
  const loadingIndicator = await page.locator('.loading-dot').count()
  console.log('Loading dots count:', loadingIndicator)

  // Try waiting for network to be idle
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    console.log('Network did not become idle')
  })

  // Final screenshot
  await page.screenshot({ path: '.playwright-mcp/debug-4-final.png', fullPage: true })

  // Print page title and URL
  console.log('Page title:', await page.title())
  console.log('Page URL:', page.url())
})
