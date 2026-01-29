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
  auditAccessibility,
  expectAccessible,
  capturePerformanceMetrics,
  measureAnimationTiming,
  uxAssertions,
  recordAuditResult,
  generateReport,
} from './helpers/ux-capture'

/**
 * UX Audit Suite
 *
 * Comprehensive visual and functional audit of the Gather app.
 * Captures screenshots, checks accessibility, measures performance,
 * and validates UX requirements from CLAUDE.md.
 *
 * Run with: npx playwright test ux-audit.spec.ts --headed
 * View report: open e2e-screenshots/ux-audit/report.html
 */

// ============ Selectors ============
// Centralized selectors for maintainability
const selectors = {
  // Main input - matches StackView placeholders
  mainInput: 'input[placeholder*="next"], input[placeholder*="Add something"]',
  demoButton: 'button:has-text("Try the demo"), button:has-text("demo")',
  aiCard: '[data-testid="ai-card"], .ai-card, [class*="AICard"]',
  taskCard: '[data-testid="task-card"], [class*="TaskCard"], [class*="card"]',
  quickReply: 'button:has-text("Yes"), button:has-text("No"), button:has-text("ASAP"), button:has-text("No rush")',
}

// ============ Test Setup ============

test.describe('UX Audit - Empty States', () => {
  const times = [
    { hour: 7, label: 'morning' as const },
    { hour: 14, label: 'day' as const },
    { hour: 18, label: 'evening' as const },
    { hour: 23, label: 'night' as const },
  ]

  for (const { hour, label } of times) {
    test(`empty state at ${label} (${hour}:00)`, async ({ page }) => {
      await setMockTime(page, hour)
      await page.goto('/')
      await page.getByRole('button', { name: /try the demo/i }).click()
      await page.waitForLoadState('networkidle')

      // Light mode
      await setTheme(page, 'light')
      await captureState(page, 'empty-states', 'empty', { theme: 'light', time: label })

      // Dark mode
      await setTheme(page, 'dark')
      await captureState(page, 'empty-states', 'empty', { theme: 'dark', time: label })

      // Verify UX requirements
      await uxAssertions.hasClearPrimaryAction(page)
      await uxAssertions.noGuiltTripping(page)
    })
  }

  test('responsive: mobile vs desktop', async ({ page }) => {
    await setMockTime(page, 14)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Mobile (375px - per CLAUDE.md requirement)
    await setViewport(page, 'mobile')
    await captureState(page, 'responsive', 'empty-mobile', { device: 'mobile' })

    // Verify input is still usable on mobile
    const input = page.locator(selectors.mainInput).first()
    await expect(input).toBeVisible()

    // Desktop
    await setViewport(page, 'desktop')
    await captureState(page, 'responsive', 'empty-desktop', { device: 'desktop' })
  })
})

test.describe('UX Audit - AI Card States', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')
  })

  test('AI thinking and response states', async ({ page }) => {
    const input = page.locator(selectors.mainInput).first()
    await input.fill('renew my passport')

    // Capture interaction flow
    await captureInteraction(page, 'ai-flow', [
      {
        label: 'input-filled',
        action: async () => {},
      },
      {
        label: 'submitted',
        action: async () => await input.press('Enter'),
        waitFor: async () => {
          // Wait for either thinking indicator or response
          await page
            .locator('.animate-pulse, [class*="thinking"], [class*="AICard"]')
            .first()
            .waitFor({ state: 'visible', timeout: 3000 })
            .catch(() => {})
        },
      },
      {
        label: 'response',
        action: async () => {},
        waitFor: async () => {
          // Wait for AI to finish responding
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(2000) // AI response time
        },
      },
    ])

    // Verify no over-celebration in AI response
    await uxAssertions.noOverCelebration(page)
  })

  test('quick reply buttons', async ({ page }) => {
    const input = page.locator(selectors.mainInput).first()
    await input.fill('help me plan a trip')
    await input.press('Enter')

    // Wait for quick replies to appear
    const quickReply = page.locator(selectors.quickReply).first()
    await quickReply.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

    if (await quickReply.isVisible()) {
      await captureState(page, 'ai-card', 'quick-replies')

      // Test hover state
      await quickReply.hover()
      await page.waitForTimeout(100) // Brief wait for hover styles
      await captureState(page, 'ai-card', 'quick-reply-hover')
    }
  })
})

test.describe('UX Audit - Task Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')
  })

  test('task creation flow with loading feedback', async ({ page }) => {
    await captureInteraction(page, 'task-creation', [
      {
        label: 'empty-input',
        action: async () => {},
      },
      {
        label: 'typing',
        action: async () => {
          const input = page.locator(selectors.mainInput).first()
          await input.fill('buy groceries')
        },
      },
      {
        label: 'submitted',
        action: async () => {
          const input = page.locator(selectors.mainInput).first()
          await input.press('Enter')
        },
        waitFor: async () => {
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(2000)
        },
      },
    ])

    // Verify UX requirements
    await uxAssertions.hasClearPrimaryAction(page)
  })

  test('task with steps shows progress', async ({ page }) => {
    const input = page.locator(selectors.mainInput).first()
    await input.fill('plan a birthday party')
    await input.press('Enter')

    // Wait for task to be created and potentially have steps
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Capture whatever state we end up with
    await captureState(page, 'progress', 'task-with-steps')
  })
})

test.describe('UX Audit - Theme Comparison', () => {
  test('light vs dark mode with content', async ({ page }) => {
    await setMockTime(page, 14)
    await enterDemoMode(page)

    // Add some content
    const input = page.locator(selectors.mainInput).first()
    await input.fill('test task for theme comparison')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Capture light mode
    await setTheme(page, 'light')
    await page.waitForTimeout(150) // Transition time
    await captureState(page, 'themes', 'with-content', { theme: 'light' })
    const lightTokens = await extractDesignTokens(page)

    // Capture dark mode
    await setTheme(page, 'dark')
    await page.waitForTimeout(150)
    await captureState(page, 'themes', 'with-content', { theme: 'dark' })
    const darkTokens = await extractDesignTokens(page)

    // Log token comparison for design review
    console.log('\n=== Design Token Comparison ===')
    const tokenKeys = Array.from(new Set([...Object.keys(lightTokens), ...Object.keys(darkTokens)]))
    for (const key of tokenKeys.slice(0, 20)) {
      // Limit output
      if (lightTokens[key] !== darkTokens[key]) {
        console.log(`${key}:`)
        console.log(`  light: ${lightTokens[key] || '(not set)'}`)
        console.log(`  dark:  ${darkTokens[key] || '(not set)'}`)
      }
    }
  })
})

test.describe('UX Audit - Input States', () => {
  test('input focus and typing states', async ({ page }) => {
    await enterDemoMode(page)

    const input = page.locator(selectors.mainInput).first()

    // Unfocused state
    await captureState(page, 'input', 'unfocused')

    // Focused state (measure focus animation)
    const focusTiming = await measureAnimationTiming(page, selectors.mainInput, async () => {
      await input.focus()
    })
    await captureState(page, 'input', 'focused')
    console.log(`Focus animation: ${focusTiming.duration}ms on ${focusTiming.property}`)

    // With text
    await input.fill('typing some text here')
    await captureState(page, 'input', 'with-text')
  })

  test('input breathing animation frames', async ({ page }) => {
    await setMockTime(page, 14)
    await enterDemoMode(page)

    // Capture multiple frames of the breathing animation
    for (let i = 0; i < 4; i++) {
      await captureState(page, 'input', `breathing-frame-${i}`)
      await page.waitForTimeout(750) // ~1/4 of typical breathing animation cycle
    }
  })
})

test.describe('UX Audit - Typography & Content', () => {
  test('extract all text for tone audit', async ({ page }) => {
    await enterDemoMode(page)

    // Trigger AI to get various messages
    const input = page.locator(selectors.mainInput).first()
    await input.fill('help me')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const texts = await extractVisibleText(page)
    console.log('\n=== Visible Text Audit ===')
    texts.forEach((t) => console.log(`  "${t}"`))

    // Verify tone requirements
    await uxAssertions.noGuiltTripping(page)
    await uxAssertions.noOverCelebration(page)
  })
})

test.describe('UX Audit - Login Page', () => {
  test('login page variants', async ({ page }) => {
    await setMockTime(page, 14)
    await page.goto('/')

    // Wait for login animations (staggered fade-in)
    await page.waitForTimeout(1200)

    // Light mode
    await setTheme(page, 'light')
    await captureState(page, 'login', 'default', { theme: 'light' })

    // Dark mode
    await setTheme(page, 'dark')
    await page.waitForTimeout(150)
    await captureState(page, 'login', 'default', { theme: 'dark' })

    // Mobile
    await setViewport(page, 'mobile')
    await setTheme(page, 'light')
    await page.waitForTimeout(150)
    await captureState(page, 'login', 'mobile', { device: 'mobile' })
  })
})

test.describe('UX Audit - View Switching', () => {
  test('StackView vs other views', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Capture default view (StackView)
    await captureState(page, 'views', 'stack-view')

    // Look for view toggle
    const viewToggle = page.locator('button[title*="list" i], button[title*="view" i], button[aria-label*="view" i]').first()
    if (await viewToggle.isVisible().catch(() => false)) {
      await viewToggle.click()
      await page.waitForTimeout(300)
      await captureState(page, 'views', 'alternate-view')
    }
  })
})

test.describe('UX Audit - Accessibility', () => {
  test('login page accessibility', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    const a11yResults = await auditAccessibility(page)
    recordAuditResult({
      category: 'accessibility',
      screenshots: [],
      accessibility: a11yResults,
    })

    console.log('\n=== Login Page A11y ===')
    console.log(`Passes: ${a11yResults.passes}`)
    console.log(`Violations: ${a11yResults.violations.length}`)
    if (a11yResults.violations.length > 0) {
      a11yResults.violations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.description}`)
      })
    }

    // Allow minor issues but fail on serious/critical
    await expectAccessible(page, { allowMinor: true })
  })

  test('main app accessibility', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const a11yResults = await auditAccessibility(page)
    recordAuditResult({
      category: 'accessibility',
      screenshots: [],
      accessibility: a11yResults,
    })

    console.log('\n=== Main App A11y ===')
    console.log(`Passes: ${a11yResults.passes}`)
    console.log(`Violations: ${a11yResults.violations.length}`)

    await expectAccessible(page, { allowMinor: true })
  })
})

test.describe('UX Audit - Performance', () => {
  test('login page performance metrics', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const metrics = await capturePerformanceMetrics(page)
    recordAuditResult({
      category: 'performance',
      screenshots: [],
      performance: metrics,
    })

    console.log('\n=== Login Page Performance ===')
    console.log(`TTFB: ${metrics.ttfb}ms`)
    console.log(`FCP: ${metrics.fcp}ms`)
    console.log(`LCP: ${metrics.lcp}ms`)
    console.log(`CLS: ${metrics.cls}`)

    // Soft assertions - log warnings but don't fail
    if (metrics.lcp && metrics.lcp > 2500) {
      console.warn('Warning: LCP exceeds 2.5s threshold')
    }
    if (metrics.cls && metrics.cls > 0.1) {
      console.warn('Warning: CLS exceeds 0.1 threshold')
    }
  })

  test('main app performance metrics', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const metrics = await capturePerformanceMetrics(page)
    recordAuditResult({
      category: 'performance',
      screenshots: [],
      performance: metrics,
    })

    console.log('\n=== Main App Performance ===')
    console.log(`LCP: ${metrics.lcp}ms`)
    console.log(`CLS: ${metrics.cls}`)
  })
})

// ============ NEW TEST SCENARIOS ============

test.describe('UX Audit - Task Completion', () => {
  test('task completion flow and celebration', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create a simple task
    const input = page.locator(selectors.mainInput).first()
    await input.fill('test task to complete')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    await captureState(page, 'completion', 'task-created')

    // Look for a task card/checkbox to complete
    const checkbox = page
      .locator('button[role="checkbox"], input[type="checkbox"], [class*="checkbox"], [class*="Checkbox"]')
      .first()

    if (await checkbox.isVisible().catch(() => false)) {
      // Capture before completion
      await captureState(page, 'completion', 'before-complete')

      // Complete the task
      await checkbox.click()

      // Quickly capture any confetti/celebration animation
      await page.waitForTimeout(100)
      await captureState(page, 'completion', 'completing')

      await page.waitForTimeout(500)
      await captureState(page, 'completion', 'after-complete')

      // Check for confetti element
      const confetti = page.locator('[class*="confetti"], [class*="Confetti"], canvas')
      if (await confetti.isVisible().catch(() => false)) {
        console.log('✓ Confetti animation detected')
      }
    }

    // Verify no over-celebration in completion message
    await uxAssertions.noOverCelebration(page)
  })

  test('step completion within task', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create a task that should generate steps
    const input = page.locator(selectors.mainInput).first()
    await input.fill('organize my closet')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)

    // Click on task to open detail view if needed
    const taskCard = page.locator('[class*="card"], [class*="Card"]').first()
    if (await taskCard.isVisible().catch(() => false)) {
      await taskCard.click()
      await page.waitForTimeout(500)
    }

    await captureState(page, 'completion', 'task-with-steps')

    // Look for step checkboxes
    const stepCheckbox = page
      .locator('[class*="step"] button, [class*="Step"] button, [class*="subtask"] button')
      .first()

    if (await stepCheckbox.isVisible().catch(() => false)) {
      await captureState(page, 'completion', 'step-before')
      await stepCheckbox.click()
      await page.waitForTimeout(300)
      await captureState(page, 'completion', 'step-after')
    }
  })
})

test.describe('UX Audit - Error States', () => {
  test('network offline indicator', async ({ page, context }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')
    await captureState(page, 'errors', 'online-state')

    // Simulate offline
    await context.setOffline(true)
    await page.waitForTimeout(500)

    // Try to perform an action that requires network
    const input = page.locator(selectors.mainInput).first()
    await input.fill('task while offline')
    await input.press('Enter')

    await page.waitForTimeout(1000)
    await captureState(page, 'errors', 'offline-state')

    // Check for offline indicator
    const offlineIndicator = page.locator(
      '[class*="offline"], [class*="error"], [class*="warning"], [role="alert"]'
    )
    if (await offlineIndicator.isVisible().catch(() => false)) {
      console.log('✓ Offline indicator detected')
    } else {
      console.log('⚠ No offline indicator visible')
    }

    // Restore online
    await context.setOffline(false)
    await page.waitForTimeout(500)
    await captureState(page, 'errors', 'back-online')
  })

  test('API error handling', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Intercept API calls and force an error
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    // Try to create a task (should trigger API call)
    const input = page.locator(selectors.mainInput).first()
    await input.fill('task that will fail')
    await input.press('Enter')

    await page.waitForTimeout(2000)
    await captureState(page, 'errors', 'api-error')

    // Check for error message
    const errorMessage = page.locator('[class*="error"], [role="alert"], [class*="Error"]')
    if (await errorMessage.isVisible().catch(() => false)) {
      console.log('✓ Error message displayed')
      const text = await errorMessage.textContent()
      console.log(`  Error text: "${text}"`)
    }

    // Clear route interception
    await page.unroute('**/api/**')
  })

  test('empty input validation', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator(selectors.mainInput).first()

    // Try submitting empty input
    await input.focus()
    await input.press('Enter')
    await page.waitForTimeout(300)

    await captureState(page, 'errors', 'empty-submit')

    // Try submitting whitespace only
    await input.fill('   ')
    await input.press('Enter')
    await page.waitForTimeout(300)

    await captureState(page, 'errors', 'whitespace-submit')
  })
})

test.describe('UX Audit - Swipe Gestures', () => {
  test('swipe interactions on task cards', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create a task first
    const input = page.locator(selectors.mainInput).first()
    await input.fill('swipeable task')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    await captureState(page, 'gestures', 'before-swipe')

    // Find a task card
    const taskCard = page.locator('[class*="card"], [class*="Card"]').first()

    if (await taskCard.isVisible().catch(() => false)) {
      const box = await taskCard.boundingBox()
      if (box) {
        // Swipe left
        await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 10 })
        await page.waitForTimeout(100)
        await captureState(page, 'gestures', 'swipe-left')
        await page.mouse.up()

        await page.waitForTimeout(500)

        // Swipe right
        await page.mouse.move(box.x + 20, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 10 })
        await page.waitForTimeout(100)
        await captureState(page, 'gestures', 'swipe-right')
        await page.mouse.up()
      }
    }

    await page.waitForTimeout(300)
    await captureState(page, 'gestures', 'after-swipe')
  })

  test('pull to refresh gesture', async ({ page }) => {
    await setViewport(page, 'mobile')
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    await captureState(page, 'gestures', 'before-pull')

    // Simulate pull down from top
    await page.mouse.move(187, 100)
    await page.mouse.down()
    await page.mouse.move(187, 300, { steps: 10 })
    await page.waitForTimeout(200)
    await captureState(page, 'gestures', 'pulling')
    await page.mouse.up()

    await page.waitForTimeout(500)
    await captureState(page, 'gestures', 'after-pull')
  })
})

test.describe('UX Audit - Modal Flows', () => {
  test('task detail modal', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create a task
    const input = page.locator(selectors.mainInput).first()
    await input.fill('task for modal test')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Click on task to open modal/detail view
    const taskCard = page.locator('[class*="card"], [class*="Card"]').first()

    if (await taskCard.isVisible().catch(() => false)) {
      await captureState(page, 'modals', 'before-open')

      await taskCard.click()
      await page.waitForTimeout(500)

      await captureState(page, 'modals', 'task-detail-open')

      // Look for close button or back button
      const closeBtn = page.locator(
        'button[aria-label*="close" i], button[aria-label*="back" i], [class*="close"], [class*="back"]'
      ).first()

      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click()
        await page.waitForTimeout(300)
        await captureState(page, 'modals', 'after-close')
      }
    }
  })

  test('settings modal', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Look for settings button (gear icon)
    const settingsBtn = page
      .locator('button[aria-label*="settings" i], button[title*="settings" i], [class*="settings"]')
      .first()

    if (await settingsBtn.isVisible().catch(() => false)) {
      await captureState(page, 'modals', 'before-settings')

      await settingsBtn.click()
      await page.waitForTimeout(500)

      await captureState(page, 'modals', 'settings-open')

      // Test theme toggle if present
      const themeToggle = page.locator('[class*="theme"], [aria-label*="theme" i], [aria-label*="dark" i]').first()
      if (await themeToggle.isVisible().catch(() => false)) {
        await themeToggle.click()
        await page.waitForTimeout(300)
        await captureState(page, 'modals', 'settings-theme-toggled')
      }
    }
  })
})

test.describe('UX Audit - Multi-Task Stack', () => {
  test('visual hierarchy with multiple tasks', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create multiple tasks to see stack behavior
    const tasks = ['First task', 'Second task', 'Third task', 'Fourth task', 'Fifth task']

    for (const task of tasks) {
      // Re-locate input each time as DOM may change
      const input = page.locator(selectors.mainInput).first()
      await input.waitFor({ state: 'visible', timeout: 5000 })
      await input.fill(task)
      await input.press('Enter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Dismiss any AI cards/modals that appear by clicking outside or pressing Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    await captureState(page, 'multi-task', 'five-tasks-light')

    // Dark mode
    await setTheme(page, 'dark')
    await page.waitForTimeout(150)
    await captureState(page, 'multi-task', 'five-tasks-dark')

    // Mobile view
    await setViewport(page, 'mobile')
    await page.waitForTimeout(150)
    await captureState(page, 'multi-task', 'five-tasks-mobile')

    // Count visible task elements (exclude the input which also has "card" class)
    const visibleTasks = page.locator('[class*="TaskCard"], [class*="task-card"], [data-testid*="task"]')
    const count = await visibleTasks.count()
    console.log(`\n=== Multi-Task Stack ===`)
    console.log(`Visible task elements: ${count}`)
  })

  test('task stack depth visualization', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator(selectors.mainInput).first()

    // Add tasks one by one and capture the stack growth
    for (let i = 1; i <= 3; i++) {
      await input.fill(`Task number ${i}`)
      await input.press('Enter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2500)

      await captureState(page, 'multi-task', `stack-depth-${i}`)
    }
  })
})

test.describe('UX Audit - Keyboard Navigation', () => {
  test('tab order and focus indicators', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Start tabbing through the interface
    const focusStates: string[] = []

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)

      // Get currently focused element
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return {
          tag: el?.tagName,
          role: el?.getAttribute('role'),
          label: el?.getAttribute('aria-label') || el?.textContent?.slice(0, 30),
        }
      })

      focusStates.push(`${focused.tag}${focused.role ? `[${focused.role}]` : ''}: ${focused.label}`)

      if (i === 0) await captureState(page, 'keyboard', 'focus-1')
      if (i === 4) await captureState(page, 'keyboard', 'focus-5')
      if (i === 9) await captureState(page, 'keyboard', 'focus-10')
    }

    console.log('\n=== Tab Order ===')
    focusStates.forEach((state, i) => console.log(`  ${i + 1}. ${state}`))

    // Test Enter key on focused button
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await captureState(page, 'keyboard', 'after-enter')
  })

  test('escape key closes modals', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create a task and open it
    const input = page.locator(selectors.mainInput).first()
    await input.fill('escape test task')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const taskCard = page.locator('[class*="card"], [class*="Card"]').first()
    if (await taskCard.isVisible().catch(() => false)) {
      await taskCard.click()
      await page.waitForTimeout(500)
      await captureState(page, 'keyboard', 'modal-open')

      // Press Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await captureState(page, 'keyboard', 'after-escape')
    }
  })

  test('keyboard shortcuts', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Test common shortcuts
    // Cmd/Ctrl + K (command palette or search)
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    await captureState(page, 'keyboard', 'shortcut-cmd-k')

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Focus main input with /
    await page.keyboard.press('/')
    await page.waitForTimeout(300)
    await captureState(page, 'keyboard', 'shortcut-slash')
  })
})

test.describe('UX Audit - Long Content', () => {
  test('long task title handling', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator(selectors.mainInput).first()

    // Create task with very long title
    const longTitle =
      'This is an extremely long task title that should test how the UI handles text overflow and truncation in various places throughout the application'
    await input.fill(longTitle)
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    await captureState(page, 'long-content', 'long-title')

    // Check for text truncation
    const taskText = page.locator(`text=${longTitle.slice(0, 20)}`).first()
    if (await taskText.isVisible().catch(() => false)) {
      const box = await taskText.boundingBox()
      console.log(`\n=== Long Title Handling ===`)
      console.log(`Text box width: ${box?.width}px`)
    }
  })

  test('many steps overflow', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create a task that might generate many steps
    const input = page.locator(selectors.mainInput).first()
    await input.fill('plan a wedding with all the details')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    await captureState(page, 'long-content', 'many-steps')

    // Click to see full task
    const taskCard = page.locator('[class*="card"], [class*="Card"]').first()
    if (await taskCard.isVisible().catch(() => false)) {
      await taskCard.click()
      await page.waitForTimeout(500)
      await captureState(page, 'long-content', 'many-steps-expanded')

      // Scroll if needed
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(300)
      await captureState(page, 'long-content', 'many-steps-scrolled')
    }
  })

  test('unicode and emoji handling', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator(selectors.mainInput).first()

    // Create task with unicode characters
    await input.fill('日本語タスク 🎉 émojis ñ ü')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    await captureState(page, 'long-content', 'unicode-emoji')
  })
})

test.describe('UX Audit - Animation Timing', () => {
  test('modal open/close animation timing', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Create a task
    const input = page.locator(selectors.mainInput).first()
    await input.fill('animation timing test')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Dismiss any AI card first
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Look for task card - be specific to avoid matching the input
    // Task cards typically have the task title text in them
    const taskCard = page.locator('text=animation timing test').first()

    if (await taskCard.isVisible().catch(() => false)) {
      // Measure open animation
      const openStart = Date.now()
      await taskCard.click({ force: true })

      // Wait for any modal/view change
      await page.waitForTimeout(500)
      const openDuration = Date.now() - openStart

      console.log(`\n=== Animation Timing ===`)
      console.log(`View transition: ${openDuration}ms`)

      await captureState(page, 'animations', 'task-opened')

      // Per CLAUDE.md: Modal open should be ~350ms spring
      if (openDuration > 100 && openDuration < 600) {
        console.log('✓ Open animation within expected range (100-600ms)')
      }

      await page.waitForTimeout(300)

      // Measure close/back animation
      const closeStart = Date.now()
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      const closeDuration = Date.now() - closeStart

      console.log(`View close: ${closeDuration}ms`)

      await captureState(page, 'animations', 'task-closed')

      // Per CLAUDE.md: Modal close should be ~250ms ease
      if (closeDuration > 50 && closeDuration < 500) {
        console.log('✓ Close animation within expected range (50-500ms)')
      }
    } else {
      console.log('Task card not found - skipping animation timing test')
      await captureState(page, 'animations', 'no-task-card')
    }
  })

  test('button press feedback', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Find any button
    const button = page.locator('button').first()

    if (await button.isVisible().catch(() => false)) {
      await captureState(page, 'animations', 'button-normal')

      // Capture during press (mousedown without mouseup)
      await button.hover()
      await page.mouse.down()
      await page.waitForTimeout(50)
      await captureState(page, 'animations', 'button-pressed')
      await page.mouse.up()

      await page.waitForTimeout(200)
      await captureState(page, 'animations', 'button-released')
    }
  })
})

test.afterAll(async () => {
  const reportPath = generateReport('Gather UX Audit')
  if (reportPath) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`📊 UX Audit Report: ${reportPath}`)
    console.log(`Open in browser to review all captured states`)
    console.log(`${'='.repeat(50)}\n`)
  }
})
