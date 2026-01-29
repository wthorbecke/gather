import { Page, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import * as fs from 'fs'
import * as path from 'path'

const UX_SCREENSHOTS_DIR = 'e2e-screenshots/ux-audit'

// ============ Directory Helpers ============

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// ============ Time & Environment Mocking ============

/**
 * Set mock time by overriding Date to control time-based UI (ambient gradients, greetings)
 * MUST be called BEFORE page.goto()
 */
export async function setMockTime(page: Page, hour: number, minute = 0) {
  await page.addInitScript(
    ({ h, m }) => {
      const mockDate = new Date()
      mockDate.setHours(h, m, 0, 0)
      const mockTime = mockDate.getTime()

      const OriginalDate = Date
      class MockDate extends OriginalDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(mockTime)
          } else {
            // @ts-expect-error - spread args
            super(...args)
          }
        }
        static now() {
          return mockTime
        }
      }
      // @ts-expect-error - replace global Date
      globalThis.Date = MockDate
    },
    { h: hour, m: minute }
  )
}

/**
 * Set viewport for responsive testing
 */
export async function setViewport(page: Page, device: 'mobile' | 'tablet' | 'desktop') {
  const sizes = {
    mobile: { width: 375, height: 812 }, // iPhone X
    tablet: { width: 768, height: 1024 }, // iPad
    desktop: { width: 1280, height: 800 }, // Laptop
  }
  await page.setViewportSize(sizes[device])
}

/**
 * Toggle dark mode via DOM class
 */
export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('gather-theme', t)
  }, theme)
  // Brief wait for CSS transitions
  await page.waitForTimeout(100)
}

// ============ Screenshot Capture ============

export interface CaptureOptions {
  theme?: 'light' | 'dark'
  time?: 'morning' | 'day' | 'evening' | 'night'
  device?: 'mobile' | 'tablet' | 'desktop'
  fullPage?: boolean
}

/**
 * Capture a screenshot with structured naming and metadata
 */
export async function captureState(
  page: Page,
  category: string,
  name: string,
  options?: CaptureOptions
): Promise<string> {
  ensureDir(UX_SCREENSHOTS_DIR)
  ensureDir(path.join(UX_SCREENSHOTS_DIR, category))

  const parts = [name]
  if (options?.theme) parts.push(options.theme)
  if (options?.time) parts.push(options.time)
  if (options?.device) parts.push(options.device)

  const filename = `${parts.join('-')}.png`
  const filepath = path.join(UX_SCREENSHOTS_DIR, category, filename)

  await page.screenshot({
    path: filepath,
    fullPage: options?.fullPage ?? true,
  })

  return filepath
}

/**
 * Capture a series of states during an interaction flow
 */
export async function captureInteraction(
  page: Page,
  name: string,
  steps: Array<{
    action: () => Promise<void>
    label: string
    waitFor?: string | (() => Promise<void>) // Element selector or custom wait function
  }>
): Promise<string[]> {
  ensureDir(UX_SCREENSHOTS_DIR)
  ensureDir(path.join(UX_SCREENSHOTS_DIR, 'interactions'))

  const captures: string[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    await step.action()

    // Wait for stability - prefer explicit waits over timeouts
    if (step.waitFor) {
      if (typeof step.waitFor === 'string') {
        await page.waitForSelector(step.waitFor, { state: 'visible', timeout: 5000 }).catch(() => {})
      } else {
        await step.waitFor()
      }
    } else {
      // Fallback: wait for network idle and animations to settle
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(150)
    }

    const filename = `${name}-${i + 1}-${step.label}.png`
    const filepath = path.join(UX_SCREENSHOTS_DIR, 'interactions', filename)
    await page.screenshot({ path: filepath, fullPage: true })
    captures.push(filepath)
  }

  return captures
}

// ============ Design Token Extraction ============

/**
 * Dynamically extract all CSS custom properties from the document
 */
export async function extractDesignTokens(page: Page): Promise<Record<string, string>> {
  return await page.evaluate(() => {
    const tokens: Record<string, string> = {}
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)

    // Get all CSS rules to find custom properties
    const sheets = Array.from(document.styleSheets)
    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules)
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            const props = Array.from(rule.style)
            for (const prop of props) {
              if (prop.startsWith('--')) {
                tokens[prop] = computedStyle.getPropertyValue(prop).trim()
              }
            }
          }
        }
      } catch {
        // Skip cross-origin stylesheets
      }
    }

    // Also check inline styles on :root
    const inlineProps = Array.from(root.style)
    for (const prop of inlineProps) {
      if (prop.startsWith('--')) {
        tokens[prop] = computedStyle.getPropertyValue(prop).trim()
      }
    }

    return tokens
  })
}

// ============ Accessibility Auditing ============

export interface A11yViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  nodes: number
  helpUrl: string
}

/**
 * Run accessibility audit using axe-core
 */
export async function auditAccessibility(page: Page): Promise<{
  violations: A11yViolation[]
  passes: number
  incomplete: number
}> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  return {
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact as A11yViolation['impact'],
      description: v.description,
      nodes: v.nodes.length,
      helpUrl: v.helpUrl,
    })),
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  }
}

/**
 * Assert no critical or serious accessibility violations
 */
export async function expectAccessible(page: Page, options?: { allowMinor?: boolean }) {
  const { violations } = await auditAccessibility(page)

  const severe = violations.filter((v) =>
    options?.allowMinor ? ['critical', 'serious'].includes(v.impact) : true
  )

  if (severe.length > 0) {
    const details = severe
      .map((v) => `  - [${v.impact.toUpperCase()}] ${v.id}: ${v.description} (${v.nodes} elements)`)
      .join('\n')
    throw new Error(`Accessibility violations found:\n${details}`)
  }
}

// ============ Color Contrast ============

interface ContrastResult {
  foreground: string
  background: string
  ratio: number
  passes: {
    aa: boolean
    aaLarge: boolean
    aaa: boolean
    aaaLarge: boolean
  }
}

/**
 * Check color contrast for an element, properly handling inherited/layered backgrounds
 */
export async function auditColorContrast(page: Page, selector: string): Promise<ContrastResult> {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { foreground: '', background: '', ratio: 0, passes: { aa: false, aaLarge: false, aaa: false, aaaLarge: false } }

    const style = getComputedStyle(el)
    const fg = style.color

    // Walk up the DOM to find the actual background color
    function getEffectiveBackground(element: Element): string {
      let current: Element | null = element
      while (current) {
        const bg = getComputedStyle(current).backgroundColor
        // Check if background is not transparent
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (match) {
          const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1
          if (alpha > 0.1) {
            return bg
          }
        }
        current = current.parentElement
      }
      return 'rgb(255, 255, 255)' // Default to white
    }

    const bg = getEffectiveBackground(el)

    // Parse RGB values
    function parseColor(color: string): [number, number, number] {
      const match = color.match(/\d+/g)
      if (!match) return [0, 0, 0]
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])]
    }

    // Calculate relative luminance (WCAG formula)
    function getLuminance([r, g, b]: [number, number, number]): number {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
    }

    const l1 = getLuminance(parseColor(fg))
    const l2 = getLuminance(parseColor(bg))
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    const roundedRatio = Math.round(ratio * 100) / 100

    return {
      foreground: fg,
      background: bg,
      ratio: roundedRatio,
      passes: {
        aa: roundedRatio >= 4.5,
        aaLarge: roundedRatio >= 3,
        aaa: roundedRatio >= 7,
        aaaLarge: roundedRatio >= 4.5,
      },
    }
  }, selector)
}

// ============ Performance Metrics ============

export interface PerformanceMetrics {
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay (requires interaction)
  cls: number | null // Cumulative Layout Shift
  fcp: number | null // First Contentful Paint
  ttfb: number | null // Time to First Byte
}

/**
 * Capture Core Web Vitals and performance metrics
 */
export async function capturePerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  return await page.evaluate(() => {
    return new Promise<PerformanceMetrics>((resolve) => {
      const metrics: PerformanceMetrics = {
        lcp: null,
        fid: null,
        cls: null,
        fcp: null,
        ttfb: null,
      }

      // Get navigation timing
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navEntry) {
        metrics.ttfb = navEntry.responseStart - navEntry.requestStart
      }

      // Get paint timing
      const paintEntries = performance.getEntriesByType('paint')
      for (const entry of paintEntries) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = entry.startTime
        }
      }

      // LCP observer
      let lcpValue: number | null = null
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        lcpValue = lastEntry.startTime
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

      // CLS observer
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEntry[]) {
          // @ts-expect-error - LayoutShift type not in standard types
          if (!entry.hadRecentInput) {
            // @ts-expect-error - LayoutShift type not in standard types
            clsValue += entry.value
          }
        }
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })

      // Give observers time to collect data
      setTimeout(() => {
        lcpObserver.disconnect()
        clsObserver.disconnect()
        metrics.lcp = lcpValue
        metrics.cls = Math.round(clsValue * 1000) / 1000
        resolve(metrics)
      }, 1000)
    })
  })
}

// ============ Animation Timing ============

/**
 * Measure actual animation/transition duration by watching for transitionend
 */
export async function measureAnimationTiming(
  page: Page,
  selector: string,
  triggerAction: () => Promise<void>
): Promise<{ duration: number; property: string }> {
  // Set up listener before triggering
  const timingPromise = page.evaluate((sel) => {
    return new Promise<{ duration: number; property: string }>((resolve) => {
      const el = document.querySelector(sel)
      if (!el) {
        resolve({ duration: 0, property: 'none' })
        return
      }

      const startTime = performance.now()
      const handler = (e: TransitionEvent) => {
        el.removeEventListener('transitionend', handler as EventListener)
        resolve({
          duration: Math.round(performance.now() - startTime),
          property: e.propertyName,
        })
      }
      el.addEventListener('transitionend', handler as EventListener)

      // Timeout fallback
      setTimeout(() => {
        el.removeEventListener('transitionend', handler as EventListener)
        resolve({ duration: 2000, property: 'timeout' })
      }, 2000)
    })
  }, selector)

  await triggerAction()
  return await timingPromise
}

// ============ Content Extraction ============

/**
 * Extract all visible text for content/tone auditing
 */
export async function extractVisibleText(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const texts: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        const style = getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT
        }
        const text = node.textContent?.trim()
        if (!text || text.length < 2) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })

    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim()
      if (text) texts.push(text)
    }

    return Array.from(new Set(texts)) // Dedupe
  })
}

// ============ UX Requirement Assertions ============

/**
 * Assert key UX requirements from CLAUDE.md are met
 */
export const uxAssertions = {
  /**
   * Verify primary action is visible and prominent
   */
  async hasClearPrimaryAction(page: Page) {
    // Check for main input or primary button
    const primaryAction = page.getByRole('textbox').or(page.getByRole('button', { name: /add|create|submit/i }))
    await expect(primaryAction.first()).toBeVisible()
  },

  /**
   * Verify no guilt-tripping language (per CLAUDE.md)
   */
  async noGuiltTripping(page: Page) {
    const texts = await extractVisibleText(page)
    const guiltPhrases = [
      /overdue/i,
      /you (have|still have) \d+ (overdue|incomplete)/i,
      /don't forget/i,
      /you're behind/i,
      /falling behind/i,
    ]

    for (const text of texts) {
      for (const phrase of guiltPhrases) {
        if (phrase.test(text)) {
          throw new Error(`Guilt-tripping language found: "${text}"`)
        }
      }
    }
  },

  /**
   * Verify no over-celebration (per CLAUDE.md)
   */
  async noOverCelebration(page: Page) {
    const texts = await extractVisibleText(page)
    const overCelebratePhrases = [/amazing!{2,}/i, /great job!{2,}/i, /🌟{2,}/, /!!!/, /AMAZING/]

    for (const text of texts) {
      for (const phrase of overCelebratePhrases) {
        if (phrase.test(text)) {
          throw new Error(`Over-celebration found: "${text}"`)
        }
      }
    }
  },

  /**
   * Verify loading states are present for async operations
   */
  async hasLoadingFeedback(page: Page, triggerAction: () => Promise<void>) {
    // Start watching for any loading indicator
    const loadingPromise = page
      .locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], .animate-pulse')
      .first()
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false)

    await triggerAction()
    const hadLoading = await loadingPromise

    if (!hadLoading) {
      console.warn('Warning: No loading indicator detected for async action')
    }
  },
}

// ============ Report Generation ============

export interface AuditResult {
  category: string
  screenshots: string[]
  accessibility?: Awaited<ReturnType<typeof auditAccessibility>>
  performance?: PerformanceMetrics
  tokens?: Record<string, string>
}

const auditResults: AuditResult[] = []

/**
 * Record an audit result for the final report
 */
export function recordAuditResult(result: AuditResult) {
  auditResults.push(result)
}

/**
 * Generate comprehensive HTML report from all captured data
 */
export function generateReport(title: string): string | null {
  const dir = UX_SCREENSHOTS_DIR
  if (!fs.existsSync(dir)) return null

  const categories = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory())

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #171717;
    }
    h1 { color: #171717; margin-bottom: 8px; }
    .meta { color: #525252; margin-bottom: 32px; }
    h2 {
      color: #525252;
      margin-top: 48px;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 12px;
      text-transform: capitalize;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .card img {
      width: 100%;
      height: auto;
      display: block;
      border-bottom: 1px solid #f0f0f0;
    }
    .card .label {
      padding: 12px 16px;
      font-size: 13px;
      color: #525252;
      font-weight: 500;
    }
    .summary {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary h3 { margin-top: 0; color: #171717; }
    .stat {
      display: inline-block;
      padding: 8px 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin: 4px 8px 4px 0;
      font-size: 14px;
    }
    .stat.good { background: #dcfce7; color: #166534; }
    .stat.warning { background: #fef3c7; color: #92400e; }
    .stat.bad { background: #fee2e2; color: #991b1b; }
    .a11y-violations { margin-top: 16px; }
    .violation {
      padding: 12px;
      background: #fef2f2;
      border-left: 3px solid #ef4444;
      margin: 8px 0;
      border-radius: 0 8px 8px 0;
    }
    .violation.moderate { background: #fffbeb; border-color: #f59e0b; }
    .violation.minor { background: #f0fdf4; border-color: #22c55e; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()}</p>
`

  // Add summary if we have audit results
  if (auditResults.length > 0) {
    const totalA11yViolations = auditResults.reduce(
      (sum, r) => sum + (r.accessibility?.violations.length || 0),
      0
    )
    const avgLCP =
      auditResults.filter((r) => r.performance?.lcp).reduce((sum, r) => sum + (r.performance?.lcp || 0), 0) /
        auditResults.filter((r) => r.performance?.lcp).length || 0

    html += `
  <div class="summary">
    <h3>Audit Summary</h3>
    <div>
      <span class="stat">📸 ${categories.reduce((sum, c) => sum + fs.readdirSync(path.join(dir, c)).filter((f) => f.endsWith('.png')).length, 0)} screenshots</span>
      <span class="stat ${totalA11yViolations === 0 ? 'good' : 'bad'}">♿ ${totalA11yViolations} a11y violations</span>
      ${avgLCP ? `<span class="stat ${avgLCP < 2500 ? 'good' : avgLCP < 4000 ? 'warning' : 'bad'}">⚡ ${Math.round(avgLCP)}ms LCP</span>` : ''}
    </div>
  </div>
`
  }

  // Add screenshot galleries by category
  for (const category of categories) {
    const catPath = path.join(dir, category)
    const files = fs.readdirSync(catPath).filter((f) => f.endsWith('.png'))

    if (files.length === 0) continue

    html += `<h2>${category.replace(/-/g, ' ')}</h2><div class="grid">`

    for (const file of files) {
      const relativePath = path.join(category, file)
      const label = file.replace('.png', '').replace(/-/g, ' ')
      html += `
      <div class="card">
        <a href="${relativePath}" target="_blank">
          <img src="${relativePath}" alt="${label}" loading="lazy" />
        </a>
        <div class="label">${label}</div>
      </div>`
    }

    html += `</div>`
  }

  // Add a11y violations if any
  const allViolations = auditResults.flatMap((r) => r.accessibility?.violations || [])
  if (allViolations.length > 0) {
    html += `
  <h2>Accessibility Violations</h2>
  <div class="a11y-violations">
    ${allViolations
      .map(
        (v) => `
      <div class="violation ${v.impact}">
        <strong>[${v.impact.toUpperCase()}] ${v.id}</strong>
        <p>${v.description}</p>
        <small>${v.nodes} element(s) affected • <a href="${v.helpUrl}" target="_blank">Learn more</a></small>
      </div>
    `
      )
      .join('')}
  </div>`
  }

  html += `</body></html>`

  const reportPath = path.join(dir, 'report.html')
  fs.writeFileSync(reportPath, html)
  return reportPath
}
