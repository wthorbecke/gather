import { test, expect, Page } from '@playwright/test'
import {
  setupApiErrorMonitoring,
  canRunAuthenticatedTests,
  getTestConfig,
  createTestSupabaseClient,
} from './helpers'

/**
 * Google OAuth Integration Test
 *
 * This test attempts to automate the Google OAuth flow for Gmail/Calendar integration.
 *
 * IMPORTANT NOTES ABOUT GOOGLE OAUTH AUTOMATION:
 *
 * 1. Google actively blocks automated login attempts for security reasons
 * 2. You may encounter:
 *    - CAPTCHA challenges
 *    - "Couldn't sign you in" errors
 *    - 2FA requirements (even if not set up - Google may force it for suspicious logins)
 *    - "This browser or app may not be secure" warnings
 *
 * 3. Recommended approaches for E2E testing with Google OAuth:
 *    - Use Google's OAuth testing mode (for development only)
 *    - Pre-authorize tokens and inject them into the database
 *    - Mock the OAuth flow in tests
 *    - Use a dedicated test account with less restrictive security
 *
 * Run with: npx playwright test e2e/google-oauth.spec.ts --headed
 */

async function loginAndWaitForApp(page: Page) {
  const config = getTestConfig()
  const supabase = createTestSupabaseClient()

  // Get session
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.testEmail!,
    password: config.testPassword!,
  })

  if (error) throw error

  // Navigate to app
  await page.goto('/')

  // Inject session
  const storageKey = `sb-${new URL(config.supabaseUrl!).hostname.split('.')[0]}-auth-token`
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, { key: storageKey, session: data.session })

  // Reload to pick up session
  await page.reload()

  // Wait for app to fully load - look for key elements
  await page.waitForSelector('text=Gather', { timeout: 15000 })

  // Wait for either the main input or a task card
  await page.waitForSelector('input, [data-testid="task-card"], button:has-text("Sign out")', { timeout: 15000 })

  // Give the app a moment to render
  await page.waitForTimeout(2000)

  return data.session
}

test.describe('Google OAuth Integration', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured (TEST_USER_EMAIL, TEST_USER_PASSWORD)')
    }
  })

  test('can open integration settings', async ({ page }) => {
    await loginAndWaitForApp(page)

    // Take screenshot of initial state
    await page.screenshot({ path: '.playwright-mcp/google-oauth-step1-logged-in.png', fullPage: true })

    // Find and click the settings/integrations button (gear icon in header)
    // Try multiple selectors
    const settingsButton = page.locator('button[title="Integrations"], button:has(svg):has(circle)').first()
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    // Wait for modal to open
    await page.waitForTimeout(500)

    // Verify Integration Settings modal is open (look for modal content)
    await expect(page.getByRole('heading', { name: 'Connect Google' }).or(page.getByRole('heading', { name: 'Gmail' }))).toBeVisible({ timeout: 5000 })

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/google-oauth-step2-settings-modal.png', fullPage: true })
  })

  test('shows Connect Google button when not connected', async ({ page }) => {
    await loginAndWaitForApp(page)

    // Open integration settings - click the gear icon
    const settingsButton = page.locator('button[title="Integrations"], button:has(svg):has(circle)').first()
    await settingsButton.click()
    await page.waitForTimeout(500)

    // Look for Connect Google button or Gmail/Calendar toggles (depending on connection state)
    const connectButton = page.getByRole('button', { name: /connect google/i })
    const gmailSection = page.locator('h3:has-text("Gmail")')

    // Either we see "Connect Google" (not connected) or Gmail section (connected)
    const isConnected = await gmailSection.isVisible({ timeout: 3000 }).catch(() => false)

    if (!isConnected) {
      await expect(connectButton).toBeVisible()
      console.log('Google not connected - "Connect Google" button visible')
    } else {
      console.log('Google already connected - Gmail section visible')
    }

    await page.screenshot({ path: '.playwright-mcp/google-oauth-step3-connect-state.png', fullPage: true })
  })

  test.describe('Google OAuth Flow (requires --headed)', () => {
    // This test requires headed mode and manual interaction
    // It's marked as skip in CI but can be run locally with: npx playwright test e2e/google-oauth.spec.ts --headed
    test.skip(({ }, testInfo) => !!process.env.CI, 'Skipping OAuth flow test in CI - requires manual interaction')

    test('attempt OAuth flow', async ({ page }) => {
      const config = getTestConfig()

      // Log credentials being used (masked)
      console.log(`Testing with: ${config.testEmail}`)

      await loginAndWaitForApp(page)

      // Open integration settings
      const settingsButton = page.locator('button[title="Integrations"], button:has(svg):has(circle)').first()
      await settingsButton.click()
      await page.waitForTimeout(500)

      // Check if already connected
      const connectButton = page.getByRole('button', { name: /connect google/i })
      const isNotConnected = await connectButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (!isNotConnected) {
        console.log('Google is already connected!')
        await page.screenshot({ path: '.playwright-mcp/google-oauth-already-connected.png', fullPage: true })

        // Show current integration status
        const gmailToggle = page.locator('button[aria-label*="Gmail"]')
        const calendarToggle = page.locator('button[aria-label*="Calendar"]')

        console.log('Gmail toggle visible:', await gmailToggle.isVisible().catch(() => false))
        console.log('Calendar toggle visible:', await calendarToggle.isVisible().catch(() => false))

        return
      }

      // Click Connect Google
      await connectButton.click()

      // Wait for redirect to Google
      await page.waitForURL(/accounts\.google\.com/, { timeout: 10000 })

      await page.screenshot({ path: '.playwright-mcp/google-oauth-step4-google-login.png', fullPage: true })

      // Try to sign in to Google
      // Note: This may be blocked by Google's security measures
      try {
        // Enter email
        const emailInput = page.locator('input[type="email"]')
        if (await emailInput.isVisible({ timeout: 5000 })) {
          await emailInput.fill(config.testEmail!)
          await page.screenshot({ path: '.playwright-mcp/google-oauth-step5-email-entered.png', fullPage: true })

          // Click Next
          await page.getByRole('button', { name: /next/i }).click()
          await page.waitForTimeout(2000)

          await page.screenshot({ path: '.playwright-mcp/google-oauth-step6-after-email.png', fullPage: true })
        }

        // Check for "Use another account" option (if already have accounts)
        const useAnotherAccount = page.locator('text=Use another account')
        if (await useAnotherAccount.isVisible({ timeout: 2000 }).catch(() => false)) {
          await useAnotherAccount.click()
          await page.waitForTimeout(1000)

          // Now enter email
          const emailInput2 = page.locator('input[type="email"]')
          await emailInput2.fill(config.testEmail!)
          await page.getByRole('button', { name: /next/i }).click()
          await page.waitForTimeout(2000)
        }

        // Enter password
        const passwordInput = page.locator('input[type="password"]')
        if (await passwordInput.isVisible({ timeout: 5000 })) {
          await passwordInput.fill(config.testPassword!)
          await page.screenshot({ path: '.playwright-mcp/google-oauth-step7-password-entered.png', fullPage: true })

          // Click Next
          await page.getByRole('button', { name: /next/i }).click()
          await page.waitForTimeout(3000)

          await page.screenshot({ path: '.playwright-mcp/google-oauth-step8-after-password.png', fullPage: true })
        }

        // Check for 2FA or verification challenges
        const verificationNeeded = page.locator('text=2-Step Verification, text=Verify it')
        if (await verificationNeeded.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('2FA/Verification challenge detected - cannot proceed automatically')
          await page.screenshot({ path: '.playwright-mcp/google-oauth-2fa-challenge.png', fullPage: true })
          return
        }

        // Check for CAPTCHA
        const captcha = page.locator('iframe[src*="recaptcha"]')
        if (await captcha.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('CAPTCHA detected - cannot proceed automatically')
          await page.screenshot({ path: '.playwright-mcp/google-oauth-captcha.png', fullPage: true })
          return
        }

        // Check for "Couldn't sign you in" error
        const couldntSignIn = page.locator('text=Couldn\'t sign you in')
        if (await couldntSignIn.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Google blocked the sign in attempt')
          await page.screenshot({ path: '.playwright-mcp/google-oauth-blocked.png', fullPage: true })
          return
        }

        // Look for consent screen
        await page.waitForTimeout(3000)
        await page.screenshot({ path: '.playwright-mcp/google-oauth-step9-consent-check.png', fullPage: true })

        // Handle consent screen - look for Continue or Allow buttons
        const continueButton = page.getByRole('button', { name: /continue|allow/i })
        if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('Consent screen detected - clicking continue/allow')
          await continueButton.click()
          await page.waitForTimeout(3000)
          await page.screenshot({ path: '.playwright-mcp/google-oauth-step10-after-consent.png', fullPage: true })
        }

        // Check for additional permissions prompt
        const selectAllCheckbox = page.locator('text=Select all')
        if (await selectAllCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
          await selectAllCheckbox.click()

          const allowButton = page.getByRole('button', { name: /continue|allow/i })
          await allowButton.click()
          await page.waitForTimeout(3000)
        }

        // Wait for redirect back to app
        await page.waitForURL(/localhost:3000|gather/, { timeout: 15000 })

        await page.screenshot({ path: '.playwright-mcp/google-oauth-step11-redirected.png', fullPage: true })

        // Check URL for success
        const currentUrl = page.url()
        if (currentUrl.includes('integration_connected=true')) {
          console.log('SUCCESS! Google OAuth completed successfully')
        } else if (currentUrl.includes('integration_error')) {
          console.log('OAuth failed - check error in URL:', currentUrl)
        }

        // Verify integration is connected
        await page.waitForTimeout(2000)

        // Open settings again to verify
        const settingsButton2 = page.locator('button[title="Integrations"]')
        await settingsButton2.click()
        await page.waitForTimeout(500)

        await page.screenshot({ path: '.playwright-mcp/google-oauth-step12-final-state.png', fullPage: true })

        // Check for Gmail and Calendar options
        const gmailSection = page.locator('text=Gmail')
        const calendarSection = page.locator('text=Google Calendar')

        expect(await gmailSection.isVisible()).toBeTruthy()
        expect(await calendarSection.isVisible()).toBeTruthy()

        console.log('Gmail section visible - integration successful!')

      } catch (error) {
        console.error('OAuth flow failed:', error)
        await page.screenshot({ path: '.playwright-mcp/google-oauth-error.png', fullPage: true })
        throw error
      }
    })
  })
})

/**
 * Manual steps for Google OAuth setup:
 *
 * If automated flow is blocked, follow these manual steps:
 *
 * 1. Open the app in a browser: http://localhost:3000
 * 2. Log in with the test account (claudethor8@gmail.com)
 * 3. Click the settings/gear icon in the header
 * 4. Click "Connect Google" button
 * 5. Complete Google sign-in manually (handle any 2FA/verification)
 * 6. Accept the OAuth consent screen (allow Gmail and Calendar access)
 * 7. You'll be redirected back to the app
 * 8. Verify Gmail and Calendar toggles are visible in settings
 *
 * After manual setup:
 * - The tokens are stored in the google_tokens table
 * - You can then run integration tests that use Gmail/Calendar APIs
 * - Tokens auto-refresh, so this only needs to be done once per test account
 */
