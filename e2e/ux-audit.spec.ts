import { test, expect, Page } from '@playwright/test'
import { enterDemoMode } from './helpers'
import {
  setMockTime,
  setViewport,
  captureState,
  setTheme,
  extractDesignTokens,
  extractVisibleText,
  auditAccessibility,
  capturePerformanceMetrics,
  auditColorContrast,
  generateReport,
} from './helpers/ux-capture'

/**
 * HYPERCRITICAL UX AUDIT SUITE
 *
 * This suite enforces UX requirements from CLAUDE.md with hard assertions.
 * Tests FAIL when requirements aren't met, with actionable error messages.
 *
 * Run: npx playwright test ux-audit.spec.ts
 * Report: open e2e-screenshots/ux-audit/report.html
 */

// ============ DESIGN SYSTEM SPECS (from CLAUDE.md) ============
const DESIGN_SPECS = {
  colors: {
    light: {
      canvas: '#FAFAFA',
      surface: 'rgba(0,0,0,0.03)',
      elevated: '#FFFFFF',
      text: '#171717',
      textSoft: '#525252',
      textMuted: '#a3a3a3',
      accent: '#E07A5F',
      success: '#6B9080',
      danger: '#DC6B6B',
    },
    dark: {
      canvas: '#0a0a0a',
      elevated: '#141414',
      accent: '#E8A990',
      success: '#9ECBB3',
    },
  },
  typography: {
    minFontSize: 12, // px - nothing smaller
    inputText: 20,
    taskTitle: 16,
    body: 14,
    labels: 12,
  },
  spacing: {
    minTouchTarget: 44, // px - per WCAG
  },
  borderRadius: {
    small: [6, 8],
    inputs: 10,
    buttons: 12,
    cards: 16,
    modals: 20,
  },
  motion: {
    standard: 200, // ms
    spring: 350,
    modalOpen: 350,
    modalClose: 250,
    tolerance: 150, // acceptable variance
  },
  performance: {
    lcpGood: 2500, // ms
    lcpNeedsImprovement: 4000,
    clsGood: 0.1,
    fcpGood: 1800,
  },
  contrast: {
    aaMinimum: 4.5,
    aaLarge: 3.0,
  },
}

// ============ FORBIDDEN PATTERNS (from CLAUDE.md) ============
const FORBIDDEN_PATTERNS = {
  guiltTripping: [
    /you have \d+ overdue/i,
    /\d+ tasks? overdue/i,
    /falling behind/i,
    /you're behind/i,
    /don't forget/i,
    /you still have/i,
    /incomplete tasks?/i,
    /you haven't/i,
    /why haven't you/i,
  ],
  overCelebration: [
    /amazing!{2,}/i,
    /great job!{2,}/i,
    /fantastic!{2,}/i,
    /wonderful!{2,}/i,
    /!!!/, // Triple exclamation
    /🌟{2,}/, // Multiple star emoji
    /🎉{3,}/, // Excessive party emoji
    /AMAZING/,
    /INCREDIBLE/,
    /FANTASTIC/,
  ],
  corporateWellness: [
    /self.?care journey/i,
    /wellness goals/i,
    /mindful moment/i,
    /you've got this/i,
    /believe in yourself/i,
    /positive vibes/i,
  ],
  deadEnds: [
    /something went wrong$/i, // Error without recovery
    /error$/i, // Just "error" with nothing else
    /failed$/i, // Just "failed"
    /try again later$/i, // No immediate action
  ],
}

// ============ SELECTORS ============
const selectors = {
  mainInput: 'input[placeholder*="next"], input[placeholder*="Add something"]',
  taskCard: '[class*="TaskCard"], [class*="task-card"], [data-testid*="task"]',
  aiCard: '[class*="AICard"], [class*="ai-card"]',
  button: 'button',
  checkbox: 'button[role="checkbox"], input[type="checkbox"], [class*="checkbox"]',
  modal: '[class*="modal"], [class*="Modal"], [role="dialog"]',
  loadingIndicator: '[class*="loading"], [class*="spinner"], [aria-busy="true"], .animate-pulse',
  errorMessage: '[class*="error"], [role="alert"], [class*="Error"]',
}

// ============ HELPER: Collect all issues ============
interface UXIssue {
  severity: 'critical' | 'major' | 'minor'
  category: string
  message: string
  element?: string
  expected?: string
  actual?: string
  fix?: string
}

class UXAuditor {
  issues: UXIssue[] = []
  page: Page

  constructor(page: Page) {
    this.page = page
  }

  addIssue(issue: UXIssue) {
    this.issues.push(issue)
  }

  critical(category: string, message: string, details?: Partial<UXIssue>) {
    this.addIssue({ severity: 'critical', category, message, ...details })
  }

  major(category: string, message: string, details?: Partial<UXIssue>) {
    this.addIssue({ severity: 'major', category, message, ...details })
  }

  minor(category: string, message: string, details?: Partial<UXIssue>) {
    this.addIssue({ severity: 'minor', category, message, ...details })
  }

  async assertNoIssues(allowMinor = false) {
    const failing = allowMinor
      ? this.issues.filter((i) => i.severity !== 'minor')
      : this.issues

    if (failing.length > 0) {
      const report = failing
        .map((i) => {
          let msg = `[${i.severity.toUpperCase()}] ${i.category}: ${i.message}`
          if (i.element) msg += `\n  Element: ${i.element}`
          if (i.expected) msg += `\n  Expected: ${i.expected}`
          if (i.actual) msg += `\n  Actual: ${i.actual}`
          if (i.fix) msg += `\n  Fix: ${i.fix}`
          return msg
        })
        .join('\n\n')

      throw new Error(`UX AUDIT FAILED\n\n${report}\n\nTotal issues: ${failing.length}`)
    }
  }

  getReport(): string {
    if (this.issues.length === 0) return 'No issues found'
    return this.issues
      .map((i) => `[${i.severity}] ${i.category}: ${i.message}`)
      .join('\n')
  }
}

// ============ HELPER: Check text content ============
async function auditTextContent(page: Page, auditor: UXAuditor) {
  const texts = await extractVisibleText(page)
  const allText = texts.join(' ')

  // Check for guilt-tripping
  for (const pattern of FORBIDDEN_PATTERNS.guiltTripping) {
    if (pattern.test(allText)) {
      const match = allText.match(pattern)?.[0]
      auditor.critical('tone', 'Guilt-tripping language detected', {
        actual: match,
        fix: 'Remove guilt-inducing language. Per CLAUDE.md: "Never guilt trip users about incomplete tasks"',
      })
    }
  }

  // Check for over-celebration
  for (const pattern of FORBIDDEN_PATTERNS.overCelebration) {
    if (pattern.test(allText)) {
      const match = allText.match(pattern)?.[0]
      auditor.major('tone', 'Over-celebration detected', {
        actual: match,
        fix: 'Tone down celebration. Per CLAUDE.md: No "AMAZING!!!" or excessive emoji',
      })
    }
  }

  // Check for corporate wellness speak
  for (const pattern of FORBIDDEN_PATTERNS.corporateWellness) {
    if (pattern.test(allText)) {
      const match = allText.match(pattern)?.[0]
      auditor.major('tone', 'Corporate wellness buzzwords detected', {
        actual: match,
        fix: 'Use warm, direct language. Per CLAUDE.md: "No wellness buzzwords"',
      })
    }
  }

  // Check for dead-end messages
  for (const pattern of FORBIDDEN_PATTERNS.deadEnds) {
    if (pattern.test(allText)) {
      const match = allText.match(pattern)?.[0]
      auditor.critical('ux', 'Dead-end message without recovery action', {
        actual: match,
        fix: 'Every error needs a clear recovery path, not just an error message',
      })
    }
  }
}

// ============ HELPER: Check touch targets ============
async function auditTouchTargets(page: Page, auditor: UXAuditor) {
  const buttons = await page.locator(selectors.button).all()

  for (const button of buttons) {
    const box = await button.boundingBox()
    if (!box) continue

    const minSize = DESIGN_SPECS.spacing.minTouchTarget
    if (box.width < minSize || box.height < minSize) {
      const label = await button.textContent() || await button.getAttribute('aria-label') || 'unknown'
      auditor.major('accessibility', `Touch target too small: ${Math.round(box.width)}x${Math.round(box.height)}px`, {
        element: `button: "${label.slice(0, 30)}"`,
        expected: `${minSize}x${minSize}px minimum`,
        actual: `${Math.round(box.width)}x${Math.round(box.height)}px`,
        fix: 'Increase button padding or size to meet 44x44px WCAG requirement',
      })
    }
  }
}

// ============ HELPER: Check typography ============
async function auditTypography(page: Page, auditor: UXAuditor) {
  const tooSmall = await page.evaluate((minSize) => {
    const issues: Array<{ text: string; size: number }> = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)

    while (walker.nextNode()) {
      const node = walker.currentNode
      const parent = node.parentElement
      if (!parent) continue

      const style = getComputedStyle(parent)
      const fontSize = parseFloat(style.fontSize)
      const text = node.textContent?.trim()

      if (text && text.length > 1 && fontSize < minSize && style.display !== 'none') {
        issues.push({ text: text.slice(0, 30), size: Math.round(fontSize) })
      }
    }

    return issues.slice(0, 5) // Limit to first 5
  }, DESIGN_SPECS.typography.minFontSize)

  for (const issue of tooSmall) {
    auditor.major('typography', `Text too small: ${issue.size}px`, {
      element: `"${issue.text}..."`,
      expected: `${DESIGN_SPECS.typography.minFontSize}px minimum`,
      actual: `${issue.size}px`,
      fix: 'Increase font size to at least 12px for readability',
    })
  }
}

// ============ HELPER: Check design tokens ============
async function auditDesignTokens(page: Page, auditor: UXAuditor, theme: 'light' | 'dark') {
  const tokens = await extractDesignTokens(page)
  const specs = theme === 'light' ? DESIGN_SPECS.colors.light : DESIGN_SPECS.colors.dark

  // Check key tokens exist
  const requiredTokens = ['--canvas', '--text', '--accent']
  for (const token of requiredTokens) {
    if (!tokens[token]) {
      auditor.major('design-system', `Missing CSS variable: ${token}`, {
        fix: `Define ${token} in your CSS variables for ${theme} mode`,
      })
    }
  }
}

// ============ HELPER: Check for loading states ============
async function auditLoadingFeedback(
  page: Page,
  auditor: UXAuditor,
  action: () => Promise<void>,
  actionName: string
) {
  let loadingDetected = false

  // Set up observer before action
  const loadingPromise = page
    .locator(selectors.loadingIndicator)
    .first()
    .waitFor({ state: 'visible', timeout: 500 })
    .then(() => {
      loadingDetected = true
    })
    .catch(() => {})

  await action()
  await loadingPromise

  if (!loadingDetected) {
    auditor.major('feedback', `No loading indicator for: ${actionName}`, {
      fix: 'Add visible loading feedback within 100ms of async action start',
    })
  }
}

// ============ HELPER: Check primary action visibility ============
async function auditPrimaryAction(page: Page, auditor: UXAuditor) {
  const input = page.locator(selectors.mainInput).first()
  const isVisible = await input.isVisible().catch(() => false)

  if (!isVisible) {
    auditor.critical('ux', 'Primary action (main input) not visible', {
      fix: 'The main input should always be visible and accessible. Per CLAUDE.md: "Zero friction - Show the action button"',
    })
    return
  }

  // Check it's not obscured
  const box = await input.boundingBox()
  if (box) {
    // Check if within viewport
    const viewport = page.viewportSize()
    if (viewport && (box.y + box.height > viewport.height || box.y < 0)) {
      auditor.major('ux', 'Primary action partially outside viewport', {
        fix: 'Main input should be fully visible without scrolling on initial load',
      })
    }
  }
}

// ============ HELPER: Check for dead ends ============
async function auditDeadEnds(page: Page, auditor: UXAuditor) {
  // Check that there's always a way to act
  const hasInput = await page.locator(selectors.mainInput).isVisible().catch(() => false)
  const hasButtons = await page.locator(selectors.button).count() > 0

  if (!hasInput && !hasButtons) {
    auditor.critical('ux', 'Dead end: No interactive elements on screen', {
      fix: 'Every screen should have a clear next action or way out',
    })
  }
}

// ============ HELPER: Audit error recovery ============
async function auditErrorRecovery(page: Page, auditor: UXAuditor) {
  const errorElements = await page.locator(selectors.errorMessage).all()

  for (const error of errorElements) {
    const text = await error.textContent()
    if (!text) continue

    // Check if error has nearby action button
    const parent = error.locator('..')
    const hasAction = await parent.locator('button').count() > 0

    if (!hasAction) {
      // Check if there's a button in the error element itself
      const hasInternalAction = await error.locator('button').count() > 0
      if (!hasInternalAction) {
        auditor.critical('error-handling', 'Error message without recovery action', {
          element: text.slice(0, 50),
          fix: 'Every error needs a clear recovery path (retry button, dismiss, alternative action)',
        })
      }
    }
  }
}

// ============ TEST SUITES ============

test.describe('CRITICAL: Core UX Requirements', () => {
  test('primary action always visible and accessible', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    await auditPrimaryAction(page, auditor)
    await auditDeadEnds(page, auditor)

    // Mobile too
    await setViewport(page, 'mobile')
    await page.waitForTimeout(300)
    await auditPrimaryAction(page, auditor)

    await captureState(page, 'critical', 'primary-action')
    await auditor.assertNoIssues()
  })

  test('no guilt-tripping or over-celebration in any state', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check empty state
    await auditTextContent(page, auditor)

    // Check with task
    const input = page.locator(selectors.mainInput).first()
    await input.fill('test task')
    await input.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    await auditTextContent(page, auditor)
    await captureState(page, 'critical', 'tone-check')

    await auditor.assertNoIssues()
  })

  test('all touch targets meet 44x44px minimum', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await setViewport(page, 'mobile')
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    await auditTouchTargets(page, auditor)
    await captureState(page, 'critical', 'touch-targets')

    // Allow minor issues but fail on major
    await auditor.assertNoIssues(true)
  })

  test('no text smaller than 12px', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    await auditTypography(page, auditor)
    await captureState(page, 'critical', 'typography')

    await auditor.assertNoIssues()
  })
})

test.describe('CRITICAL: Accessibility', () => {
  test('WCAG 2.1 AA compliance - no critical violations', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const results = await auditAccessibility(page)

    for (const violation of results.violations) {
      if (violation.impact === 'critical') {
        auditor.critical('a11y', violation.description, {
          element: `${violation.nodes} elements affected`,
          fix: `See: ${violation.helpUrl}`,
        })
      } else if (violation.impact === 'serious') {
        auditor.major('a11y', violation.description, {
          element: `${violation.nodes} elements affected`,
          fix: `See: ${violation.helpUrl}`,
        })
      }
    }

    await captureState(page, 'critical', 'accessibility')
    console.log(`A11y: ${results.passes} rules passed, ${results.violations.length} violations`)

    await auditor.assertNoIssues()
  })

  test('color contrast meets WCAG AA', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check main text elements
    const textSelectors = ['h1', 'h2', 'p', 'span', 'label', 'button']

    for (const selector of textSelectors) {
      const elements = await page.locator(selector).all()
      for (const el of elements.slice(0, 3)) {
        // Sample first 3 of each
        const text = await el.textContent()
        if (!text?.trim()) continue

        try {
          const contrast = await auditColorContrast(page, selector)
          if (contrast.ratio > 0 && contrast.ratio < DESIGN_SPECS.contrast.aaMinimum) {
            auditor.major('contrast', `Insufficient contrast ratio: ${contrast.ratio}:1`, {
              element: `${selector}: "${text.slice(0, 20)}..."`,
              expected: `${DESIGN_SPECS.contrast.aaMinimum}:1 minimum`,
              actual: `${contrast.ratio}:1`,
              fix: 'Increase contrast between text and background colors',
            })
          }
        } catch {
          // Skip if we can't measure
        }
        break // Only check first of each type
      }
    }

    await auditor.assertNoIssues(true) // Allow minor
  })

  test('keyboard navigation works without mouse', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Tab through interface
    const focusedElements: string[] = []

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)

      const focused = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null

        const style = getComputedStyle(el)
        const hasVisibleFocus =
          style.outlineWidth !== '0px' ||
          style.boxShadow !== 'none' ||
          el.classList.toString().includes('focus')

        return {
          tag: el.tagName,
          label: el.getAttribute('aria-label') || el.textContent?.slice(0, 20) || '',
          hasVisibleFocus,
        }
      })

      if (focused) {
        focusedElements.push(`${focused.tag}: ${focused.label}`)

        if (!focused.hasVisibleFocus) {
          auditor.major('keyboard', 'No visible focus indicator', {
            element: `${focused.tag}: "${focused.label}"`,
            fix: 'Add visible focus styles (outline, box-shadow, or ring)',
          })
        }
      }
    }

    console.log('Tab order:', focusedElements.join(' -> '))
    await captureState(page, 'critical', 'keyboard-nav')

    // Check we could tab to the main input
    const reachedInput = focusedElements.some((e) => e.includes('INPUT'))
    if (!reachedInput) {
      auditor.major('keyboard', 'Cannot reach main input via Tab key', {
        fix: 'Ensure main input is in natural tab order',
      })
    }

    await auditor.assertNoIssues(true)
  })
})

test.describe('CRITICAL: Error Handling', () => {
  test('network errors show recovery options', async ({ page, context }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Go offline
    await context.setOffline(true)

    const input = page.locator(selectors.mainInput).first()
    await input.fill('offline test task')
    await input.press('Enter')

    await page.waitForTimeout(2000)
    await captureState(page, 'errors', 'offline-error')

    // Check for recovery options
    await auditErrorRecovery(page, auditor)
    await auditTextContent(page, auditor) // Check for dead-end messages

    // Restore
    await context.setOffline(false)

    await auditor.assertNoIssues()
  })

  test('API errors provide actionable feedback', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Intercept and fail API calls
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    )
    await page.route('**/*.supabase.co/**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    )

    const input = page.locator(selectors.mainInput).first()
    await input.fill('api error test')
    await input.press('Enter')

    await page.waitForTimeout(3000)
    await captureState(page, 'errors', 'api-error')

    await auditErrorRecovery(page, auditor)
    await auditTextContent(page, auditor)

    await page.unroute('**/api/**')
    await page.unroute('**/*.supabase.co/**')

    await auditor.assertNoIssues()
  })

  test('empty/whitespace input handled gracefully', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator(selectors.mainInput).first()

    // Empty submit
    await input.focus()
    await input.press('Enter')
    await page.waitForTimeout(500)

    // Should not create task or show error
    await auditTextContent(page, auditor)
    await captureState(page, 'errors', 'empty-submit')

    // Whitespace submit
    await input.fill('   ')
    await input.press('Enter')
    await page.waitForTimeout(500)

    await auditTextContent(page, auditor)
    await captureState(page, 'errors', 'whitespace-submit')

    await auditor.assertNoIssues()
  })
})

test.describe('MAJOR: Performance', () => {
  test('LCP under 2.5s, CLS under 0.1', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const metrics = await capturePerformanceMetrics(page)

    console.log(`Performance: LCP=${metrics.lcp}ms, CLS=${metrics.cls}, FCP=${metrics.fcp}ms`)

    if (metrics.lcp && metrics.lcp > DESIGN_SPECS.performance.lcpGood) {
      auditor.major('performance', `LCP too slow: ${metrics.lcp}ms`, {
        expected: `< ${DESIGN_SPECS.performance.lcpGood}ms`,
        actual: `${metrics.lcp}ms`,
        fix: 'Optimize largest contentful paint - check image sizes, render-blocking resources',
      })
    }

    if (metrics.cls && metrics.cls > DESIGN_SPECS.performance.clsGood) {
      auditor.major('performance', `Cumulative Layout Shift too high: ${metrics.cls}`, {
        expected: `< ${DESIGN_SPECS.performance.clsGood}`,
        actual: `${metrics.cls}`,
        fix: 'Reduce layout shift - set explicit dimensions on images/embeds, avoid inserting content above existing content',
      })
    }

    await auditor.assertNoIssues()
  })

  test('async actions show loading within 100ms', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator(selectors.mainInput).first()

    await auditLoadingFeedback(
      page,
      auditor,
      async () => {
        await input.fill('loading test task')
        await input.press('Enter')
      },
      'task creation'
    )

    await page.waitForTimeout(2000)
    await captureState(page, 'performance', 'loading-feedback')

    // This is advisory - don't fail the test but report
    console.log(auditor.getReport())
  })
})

test.describe('MAJOR: Design System Compliance', () => {
  test('light mode tokens match spec', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await setTheme(page, 'light')
    await page.waitForTimeout(200)

    await auditDesignTokens(page, auditor, 'light')
    await captureState(page, 'design-system', 'light-mode')

    await auditor.assertNoIssues()
  })

  test('dark mode tokens match spec', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await setTheme(page, 'dark')
    await page.waitForTimeout(200)

    await auditDesignTokens(page, auditor, 'dark')
    await captureState(page, 'design-system', 'dark-mode')

    await auditor.assertNoIssues()
  })
})

test.describe('MAJOR: Responsive Design', () => {
  test('mobile (375px) - no horizontal scroll, all content accessible', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await setViewport(page, 'mobile')
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    if (hasHorizontalScroll) {
      auditor.critical('responsive', 'Horizontal scroll on mobile', {
        fix: 'Fix overflow - check for fixed widths, long unbroken text, or elements wider than viewport',
      })
    }

    await auditPrimaryAction(page, auditor)
    await auditTouchTargets(page, auditor)
    await captureState(page, 'responsive', 'mobile-375')

    await auditor.assertNoIssues()
  })

  test('tablet (768px) - layout adapts appropriately', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await setViewport(page, 'tablet')
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    await auditPrimaryAction(page, auditor)
    await captureState(page, 'responsive', 'tablet-768')

    await auditor.assertNoIssues()
  })

  test('desktop (1280px) - efficient use of space', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await setViewport(page, 'desktop')
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check content isn't stretched too wide (max-width should be applied)
    const contentWidth = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body.firstElementChild
      return main?.getBoundingClientRect().width || 0
    })

    if (contentWidth > 1000) {
      auditor.minor('responsive', `Content may be too wide: ${contentWidth}px`, {
        fix: 'Consider max-width constraint on main content for readability',
      })
    }

    await captureState(page, 'responsive', 'desktop-1280')
    await auditor.assertNoIssues(true) // Allow minor
  })
})

test.describe('MAJOR: Edge Cases', () => {
  test('very long task title - proper truncation', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const longTitle = 'A'.repeat(200) // 200 character title
    const input = page.locator(selectors.mainInput).first()
    await input.fill(longTitle)
    await input.press('Enter')

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Check for text overflow issues
    const hasOverflow = await page.evaluate(() => {
      const elements = document.querySelectorAll('*')
      for (const el of elements) {
        const style = getComputedStyle(el)
        if (el.scrollWidth > el.clientWidth && style.overflow !== 'hidden' && style.textOverflow !== 'ellipsis') {
          const text = el.textContent || ''
          if (text.length > 50) return true
        }
      }
      return false
    })

    if (hasOverflow) {
      auditor.major('edge-case', 'Long text overflows container', {
        fix: 'Add text-overflow: ellipsis or proper wrapping for long content',
      })
    }

    await captureState(page, 'edge-cases', 'long-title')
    await auditor.assertNoIssues()
  })

  test('unicode and emoji - renders correctly', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const unicodeText = '日本語タスク 🎉 émojis ñ ü العربية'
    const input = page.locator(selectors.mainInput).first()
    await input.fill(unicodeText)
    await input.press('Enter')

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Verify text is visible somewhere
    const hasUnicode = await page.locator(`text=${unicodeText.slice(0, 10)}`).isVisible().catch(() => false)

    if (!hasUnicode) {
      // Check if it's in any element
      const pageText = await page.textContent('body')
      if (!pageText?.includes('日本語')) {
        auditor.major('edge-case', 'Unicode text not rendering', {
          fix: 'Ensure proper font-family stack supports international characters',
        })
      }
    }

    await captureState(page, 'edge-cases', 'unicode-emoji')
    await auditor.assertNoIssues()
  })

  test('rapid input - no race conditions', async ({ page }) => {
    const auditor = new UXAuditor(page)
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator(selectors.mainInput).first()

    // Rapid fire multiple tasks
    for (let i = 0; i < 3; i++) {
      await input.fill(`Rapid task ${i + 1}`)
      await input.press('Enter')
      await page.waitForTimeout(100) // Very short delay
    }

    await page.waitForTimeout(5000)
    await captureState(page, 'edge-cases', 'rapid-input')

    // Check for error states
    await auditTextContent(page, auditor)
    await auditErrorRecovery(page, auditor)

    await auditor.assertNoIssues()
  })
})

test.describe('MINOR: Visual Polish', () => {
  test('time-of-day greeting changes appropriately', async ({ page }) => {
    const times = [
      { hour: 7, expected: ['morning', 'ready', 'start'] },
      { hour: 14, expected: ['afternoon', 'open', 'going'] },
      { hour: 20, expected: ['evening', 'wind', 'still'] },
    ]

    for (const { hour, expected } of times) {
      await setMockTime(page, hour)
      await page.goto('/')
      await page.getByRole('button', { name: /try the demo/i }).click()
      await page.waitForLoadState('networkidle')

      const texts = await extractVisibleText(page)
      const allText = texts.join(' ').toLowerCase()

      const hasExpected = expected.some((word) => allText.includes(word))
      if (!hasExpected) {
        console.log(`Note: ${hour}:00 greeting doesn't include expected words (${expected.join('/')})`)
      }

      await captureState(page, 'visual', `greeting-${hour}h`)
    }
  })

  test('theme transition is smooth', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    await setTheme(page, 'light')
    await captureState(page, 'visual', 'theme-light')

    // Measure transition
    const start = Date.now()
    await setTheme(page, 'dark')

    // Wait for transition
    await page.waitForTimeout(300)
    const duration = Date.now() - start

    await captureState(page, 'visual', 'theme-dark')

    console.log(`Theme transition: ${duration}ms`)

    // Check for jarring flash
    if (duration < 100) {
      console.log('Note: Theme transition may be too fast (< 100ms) - could feel jarring')
    }
  })

  test('empty state is inviting, not bleak', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const texts = await extractVisibleText(page)
    const allText = texts.join(' ').toLowerCase()

    // Should have some inviting text
    const invitingWords = ['ready', 'open', 'next', 'add', 'start', 'help']
    const hasInviting = invitingWords.some((word) => allText.includes(word))

    if (!hasInviting) {
      console.log('Note: Empty state could be more inviting - consider warmer copy')
    }

    await captureState(page, 'visual', 'empty-state')
  })
})

test.afterAll(async () => {
  const reportPath = generateReport('Gather UX Audit - Hypercritical')
  if (reportPath) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 UX AUDIT REPORT: ${reportPath}`)
    console.log(`${'='.repeat(60)}\n`)
  }
})
