import { Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const UX_SCREENSHOTS_DIR = 'e2e-screenshots/ux-audit'

/**
 * Ensure the UX screenshots directory exists
 */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Set mock time by overriding Date to control ambient gradients
 * Call this BEFORE navigating to the page
 */
export async function setMockTime(page: Page, hour: number, minute = 0) {
  await page.addInitScript(({ h, m }) => {
    const mockDate = new Date()
    mockDate.setHours(h, m, 0, 0)
    const mockTime = mockDate.getTime()

    // Override Date constructor
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
  }, { h: hour, m: minute })
}

/**
 * Set viewport for responsive testing
 */
export async function setViewport(page: Page, device: 'mobile' | 'tablet' | 'desktop') {
  const sizes = {
    mobile: { width: 375, height: 812 },   // iPhone X
    tablet: { width: 768, height: 1024 },  // iPad
    desktop: { width: 1280, height: 800 }, // Laptop
  }
  await page.setViewportSize(sizes[device])
}

/**
 * Capture a screenshot with structured naming
 */
export async function captureState(
  page: Page,
  category: string,
  name: string,
  options?: {
    theme?: 'light' | 'dark'
    time?: 'morning' | 'day' | 'evening' | 'night'
    device?: 'mobile' | 'desktop'
    fullPage?: boolean
  }
) {
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
  // Wait for CSS transitions
  await page.waitForTimeout(100)
}

/**
 * Extract all CSS custom properties for design token audit
 */
export async function extractDesignTokens(page: Page) {
  return await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const tokens: Record<string, string> = {}

    // Get all custom properties
    const allProps = [
      '--canvas', '--surface', '--card', '--elevated', '--subtle',
      '--text', '--text-soft', '--text-muted',
      '--accent', '--accent-soft', '--accent-hover',
      '--success', '--success-soft', '--danger', '--danger-soft',
      '--border', '--border-subtle', '--border-focus',
      '--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg',
      '--ai-bg', '--ai-border', '--ai-glow',
    ]

    for (const prop of allProps) {
      tokens[prop] = root.getPropertyValue(prop).trim()
    }

    return tokens
  })
}

/**
 * Measure animation timing by watching for CSS transitions
 */
export async function measureAnimationTiming(
  page: Page,
  selector: string,
  action: () => Promise<void>
): Promise<number> {
  const startTime = Date.now()

  // Set up listener for transitionend
  const transitionPromise = page.evaluate((sel) => {
    return new Promise<void>((resolve) => {
      const el = document.querySelector(sel)
      if (!el) {
        resolve()
        return
      }
      const handler = () => {
        el.removeEventListener('transitionend', handler)
        resolve()
      }
      el.addEventListener('transitionend', handler)
      // Timeout fallback
      setTimeout(resolve, 2000)
    })
  }, selector)

  await action()
  await transitionPromise

  return Date.now() - startTime
}

/**
 * Capture a series of states during an interaction
 */
export async function captureInteraction(
  page: Page,
  name: string,
  steps: Array<{ action: () => Promise<void>; label: string; delay?: number }>
) {
  ensureDir(UX_SCREENSHOTS_DIR)
  ensureDir(path.join(UX_SCREENSHOTS_DIR, 'interactions'))

  const captures: string[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    await step.action()
    if (step.delay) await page.waitForTimeout(step.delay)

    const filename = `${name}-${i + 1}-${step.label}.png`
    const filepath = path.join(UX_SCREENSHOTS_DIR, 'interactions', filename)
    await page.screenshot({ path: filepath, fullPage: true })
    captures.push(filepath)
  }

  return captures
}

/**
 * Get all visible text for content audit
 */
export async function extractVisibleText(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const texts: string[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
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
      }
    )

    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim()
      if (text) texts.push(text)
    }

    return Array.from(new Set(texts)) // Dedupe
  })
}

/**
 * Check color contrast for accessibility
 */
export async function auditColorContrast(
  page: Page,
  selector: string
): Promise<{ foreground: string; background: string; ratio: number }> {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { foreground: '', background: '', ratio: 0 }

    const style = getComputedStyle(el)
    const fg = style.color
    const bg = style.backgroundColor

    // Simple luminance calculation
    function getLuminance(color: string): number {
      const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0]
      const [r, g, b] = rgb.map((c) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    const l1 = getLuminance(fg)
    const l2 = getLuminance(bg)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

    return { foreground: fg, background: bg, ratio: Math.round(ratio * 100) / 100 }
  }, selector)
}

/**
 * Generate an HTML report from captured screenshots
 */
export function generateReport(title: string) {
  const dir = UX_SCREENSHOTS_DIR
  if (!fs.existsSync(dir)) return

  const categories = fs.readdirSync(dir).filter((f) =>
    fs.statSync(path.join(dir, f)).isDirectory()
  )

  let html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 40px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card img { width: 100%; height: auto; display: block; }
    .card .label { padding: 10px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated: ${new Date().toISOString()}</p>
`

  for (const category of categories) {
    const catPath = path.join(dir, category)
    const files = fs.readdirSync(catPath).filter((f) => f.endsWith('.png'))

    html += `<h2>${category}</h2><div class="grid">`

    for (const file of files) {
      const relativePath = path.join(category, file)
      html += `
      <div class="card">
        <img src="${relativePath}" alt="${file}" loading="lazy" />
        <div class="label">${file.replace('.png', '')}</div>
      </div>`
    }

    html += `</div>`
  }

  html += `</body></html>`

  fs.writeFileSync(path.join(dir, 'report.html'), html)
  return path.join(dir, 'report.html')
}
