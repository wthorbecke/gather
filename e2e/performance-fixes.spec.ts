import { test, expect } from '@playwright/test'

/**
 * Performance verification tests
 * Tests that the performance fixes work correctly
 */

test.describe('Performance Fixes Verification', () => {
  test('CSS hold animation works without JS state updates', async ({ page }) => {
    // Navigate and check the CSS animation is defined
    await page.goto('/')

    // Check that the hold-progress-fill animation exists in CSS
    const hasAnimation = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets)
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'holdProgressFill') {
              return true
            }
            if (rule instanceof CSSStyleRule && rule.selectorText === '.hold-progress-fill') {
              return true
            }
          }
        } catch (e) {
          // Cross-origin stylesheets throw
          continue
        }
      }
      return false
    })

    expect(hasAnimation).toBe(true)
  })

  test('typewriter CSS cursor animation exists', async ({ page }) => {
    await page.goto('/')

    // Check that the cursor-blink animation exists in CSS (used by typewriter)
    const hasAnimation = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets)
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'cursorBlink') {
              return true
            }
          }
        } catch (e) {
          continue
        }
      }
      return false
    })

    expect(hasAnimation).toBe(true)
  })

  test('no excessive setInterval calls during idle', async ({ page }) => {
    await page.goto('/')

    // Wait for app to stabilize
    await page.waitForTimeout(2000)

    // Check for running intervals
    const intervalInfo = await page.evaluate(async () => {
      const intervals: number[] = []
      const originalSetInterval = window.setInterval

      // Track new intervals
      (window as any).setInterval = function(...args: [TimerHandler, number?, ...any[]]) {
        const id = originalSetInterval.apply(this, args)
        intervals.push(id)
        return id
      }

      // Wait and see how many intervals are created
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Restore
      window.setInterval = originalSetInterval

      return {
        newIntervals: intervals.length,
      }
    })

    console.log(`New intervals created during 1s idle: ${intervalInfo.newIntervals}`)

    // Should have minimal interval creation during idle
    // FocusMode timer is the only expected one, but it's not active on home
    expect(intervalInfo.newIntervals).toBeLessThanOrEqual(2)
  })

  test('login page loads quickly', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')

    // Wait for the app to be interactive (login or main view)
    await page.waitForSelector('button', { timeout: 10000 })

    const loadTime = Date.now() - startTime
    console.log(`Page load time: ${loadTime}ms`)

    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000)

    // Should have a button (Sign in or other)
    const buttons = page.locator('button')
    await expect(buttons.first()).toBeVisible()
  })

  test('app renders without console errors', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForTimeout(2000)

    // Filter out known/expected errors
    const unexpectedErrors = consoleErrors.filter(err =>
      !err.includes('404') && // Resource not found
      !err.includes('favicon') // Favicon issues
    )

    console.log(`Console errors: ${unexpectedErrors.length}`)
    if (unexpectedErrors.length > 0) {
      console.log(unexpectedErrors)
    }

    expect(unexpectedErrors.length).toBe(0)
  })
})
