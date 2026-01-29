import { test, expect } from '@playwright/test'
import { enterDemoMode, screenshot } from './helpers'
import {
  setMockTime,
  setViewport,
  captureState,
  setTheme,
  extractDesignTokens,
  captureInteraction,
  extractVisibleText,
  generateReport,
} from './helpers/ux-capture'

/**
 * UX Audit Suite
 *
 * This test suite captures comprehensive screenshots of every app state
 * for visual review and UX improvement. It's designed to be run manually
 * when auditing the app's design and interactions.
 *
 * Run with: npx playwright test ux-audit.spec.ts --headed
 */

test.describe('UX Audit - Empty States', () => {
  test('captures empty state at different times of day', async ({ page }) => {
    const times = [
      { hour: 7, label: 'morning' },
      { hour: 11, label: 'day' },
      { hour: 18, label: 'evening' },
      { hour: 23, label: 'night' },
    ] as const

    for (const { hour, label } of times) {
      // Set mock time before navigation
      await setMockTime(page, hour)
      await page.goto('/')
      await page.getByRole('button', { name: /try the demo/i }).click()
      await page.waitForTimeout(500)

      // Light mode
      await setTheme(page, 'light')
      await captureState(page, 'empty-states', 'empty', {
        theme: 'light',
        time: label,
      })

      // Dark mode
      await setTheme(page, 'dark')
      await captureState(page, 'empty-states', 'empty', {
        theme: 'dark',
        time: label,
      })
    }
  })

  test('captures empty state mobile vs desktop', async ({ page }) => {
    await setMockTime(page, 14) // Midday
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // Mobile
    await setViewport(page, 'mobile')
    await captureState(page, 'responsive', 'empty-mobile', { device: 'mobile' })

    // Desktop
    await setViewport(page, 'desktop')
    await captureState(page, 'responsive', 'empty-desktop', { device: 'desktop' })
  })
})

test.describe('UX Audit - AI Card States', () => {
  test('captures AI thinking state', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // Type something to trigger AI
    const input = page.locator('input[type="text"]').first()
    await input.fill('renew my passport')
    await input.press('Enter')

    // Capture thinking state quickly
    await page.waitForTimeout(200)
    await captureState(page, 'ai-card', 'thinking')

    // Wait for response and capture
    await page.waitForTimeout(3000)
    await captureState(page, 'ai-card', 'response')
  })

  test('captures AI quick reply buttons', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    const input = page.locator('input[type="text"]').first()
    await input.fill('help me plan a trip')
    await input.press('Enter')

    // Wait for question with quick replies
    await page.waitForTimeout(4000)
    await captureState(page, 'ai-card', 'quick-replies')

    // Capture hover state on first button
    const firstReply = page.locator('button').filter({ hasText: /yes|no|maybe/i }).first()
    if (await firstReply.isVisible()) {
      await firstReply.hover()
      await captureState(page, 'ai-card', 'quick-reply-hover')
    }
  })
})

test.describe('UX Audit - Task Interactions', () => {
  test('captures task creation flow', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    await captureInteraction(page, 'task-creation', [
      {
        label: 'empty-input',
        action: async () => {},
        delay: 100,
      },
      {
        label: 'typing',
        action: async () => {
          const input = page.locator('input[type="text"]').first()
          await input.fill('buy groceries')
        },
        delay: 100,
      },
      {
        label: 'submitted',
        action: async () => {
          const input = page.locator('input[type="text"]').first()
          await input.press('Enter')
        },
        delay: 3000,
      },
    ])
  })

  test('captures progress bar states', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // Add a task that should generate steps
    const input = page.locator('input[type="text"]').first()
    await input.fill('plan a birthday party')
    await input.press('Enter')

    // Wait for task creation
    await page.waitForTimeout(5000)

    // Click on task if visible
    const taskCard = page.locator('[class*="card"]').first()
    if (await taskCard.isVisible()) {
      await captureState(page, 'progress', 'with-steps')
    }
  })
})

test.describe('UX Audit - Theme Comparison', () => {
  test('captures light vs dark mode side by side', async ({ page }) => {
    await setMockTime(page, 14)
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // Add some content
    const input = page.locator('input[type="text"]').first()
    await input.fill('test task')
    await input.press('Enter')
    await page.waitForTimeout(3000)

    // Light mode
    await setTheme(page, 'light')
    await captureState(page, 'themes', 'with-content-light', { theme: 'light' })

    // Dark mode
    await setTheme(page, 'dark')
    await captureState(page, 'themes', 'with-content-dark', { theme: 'dark' })

    // Extract tokens for comparison
    const lightTokens = await setTheme(page, 'light').then(() => extractDesignTokens(page))
    const darkTokens = await setTheme(page, 'dark').then(() => extractDesignTokens(page))

    console.log('Light mode tokens:', JSON.stringify(lightTokens, null, 2))
    console.log('Dark mode tokens:', JSON.stringify(darkTokens, null, 2))
  })
})

test.describe('UX Audit - Input States', () => {
  test('captures input breathing animation', async ({ page }) => {
    await setMockTime(page, 14)
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // Capture at different points in animation cycle
    for (let i = 0; i < 4; i++) {
      await captureState(page, 'input', `breathing-${i}`)
      await page.waitForTimeout(1000)
    }
  })

  test('captures input focus state', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // Unfocused
    await captureState(page, 'input', 'unfocused')

    // Focused
    const input = page.locator('input[type="text"]').first()
    await input.focus()
    await captureState(page, 'input', 'focused')

    // With text
    await input.fill('some text here')
    await captureState(page, 'input', 'with-text')
  })
})

test.describe('UX Audit - Typography & Content', () => {
  test('extracts all visible text for tone audit', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // Trigger AI to get various messages
    const input = page.locator('input[type="text"]').first()
    await input.fill('help me')
    await input.press('Enter')
    await page.waitForTimeout(4000)

    const texts = await extractVisibleText(page)
    console.log('Visible text in app:')
    texts.forEach((t) => console.log(`  - "${t}"`))
  })
})

test.describe('UX Audit - Login Page', () => {
  test('captures login page states', async ({ page }) => {
    await setMockTime(page, 14)

    // Light mode - wait for login animations to complete (staggered fade-in up to 0.95s)
    await page.goto('/')
    await page.waitForTimeout(1200)
    await setTheme(page, 'light')
    await captureState(page, 'login', 'light')

    // Dark mode
    await setTheme(page, 'dark')
    await page.waitForTimeout(300)
    await captureState(page, 'login', 'dark')

    // Mobile
    await setViewport(page, 'mobile')
    await setTheme(page, 'light')
    await page.waitForTimeout(300)
    await captureState(page, 'login', 'mobile')
  })
})

test.describe('UX Audit - View Switching', () => {
  test('captures StackView vs HomeView', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForTimeout(500)

    // StackView (default)
    await captureState(page, 'views', 'stack-view')

    // Switch to list view if toggle exists
    const viewToggle = page.locator('button[title*="list" i], button[title*="view" i]').first()
    if (await viewToggle.isVisible()) {
      await viewToggle.click()
      await page.waitForTimeout(300)
      await captureState(page, 'views', 'home-view')
    }
  })
})

test.afterAll(async () => {
  // Generate HTML report
  const reportPath = generateReport('Gather UX Audit')
  if (reportPath) {
    console.log(`\n📊 UX Audit Report generated: ${reportPath}`)
    console.log('Open in browser to review all captured states\n')
  }
})
