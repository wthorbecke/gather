import { test, expect, Page } from '@playwright/test'
import { enterDemoMode } from './helpers'
import {
  setViewport,
  captureState,
  setTheme,
  setMockTime,
  auditAccessibility,
  capturePerformanceMetrics,
  extractVisibleText,
} from './helpers/ux-capture'
import * as fs from 'fs'
import * as path from 'path'

/**
 * QUALITY SCORECARD
 *
 * This file generates a comprehensive quality report that agents can use
 * to understand the current state of the app and identify improvement areas.
 *
 * The scorecard tracks:
 * 1. Feature completeness (what's implemented vs spec)
 * 2. UX polish level (animations, feedback, delight)
 * 3. Accessibility compliance
 * 4. Performance metrics
 * 5. Edge case handling
 * 6. Code quality signals
 *
 * Run: npx playwright test quality-scorecard.spec.ts
 * Output: e2e-screenshots/scorecard/report.json
 */

const SCORECARD_DIR = 'e2e-screenshots/scorecard'

interface Score {
  category: string
  item: string
  score: number // 0-100
  status: 'excellent' | 'good' | 'needs-work' | 'missing' | 'broken'
  notes: string
  improvementSuggestion?: string
}

interface Scorecard {
  timestamp: string
  overallScore: number
  grades: {
    features: number
    ux: number
    accessibility: number
    performance: number
    polish: number
  }
  scores: Score[]
  criticalIssues: string[]
  improvementPriorities: string[]
}

const scorecard: Scorecard = {
  timestamp: new Date().toISOString(),
  overallScore: 0,
  grades: { features: 0, ux: 0, accessibility: 0, performance: 0, polish: 0 },
  scores: [],
  criticalIssues: [],
  improvementPriorities: [],
}

function addScore(score: Score) {
  scorecard.scores.push(score)
  if (score.status === 'broken' || score.status === 'missing') {
    if (score.improvementSuggestion) {
      scorecard.criticalIssues.push(`[${score.category}] ${score.item}: ${score.improvementSuggestion}`)
    }
  }
}

function calculateGrades() {
  const categoryScores: Record<string, number[]> = {}

  for (const score of scorecard.scores) {
    if (!categoryScores[score.category]) {
      categoryScores[score.category] = []
    }
    categoryScores[score.category].push(score.score)
  }

  // Map categories to grade keys
  const categoryMap: Record<string, keyof typeof scorecard.grades> = {
    Features: 'features',
    UX: 'ux',
    Accessibility: 'accessibility',
    Performance: 'performance',
    Polish: 'polish',
  }

  for (const [category, scores] of Object.entries(categoryScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const key = categoryMap[category]
    if (key) {
      scorecard.grades[key] = Math.round(avg)
    }
  }

  scorecard.overallScore = Math.round(
    Object.values(scorecard.grades).reduce((a, b) => a + b, 0) / Object.values(scorecard.grades).length
  )

  // Generate improvement priorities
  const sortedScores = [...scorecard.scores].sort((a, b) => a.score - b.score)
  scorecard.improvementPriorities = sortedScores
    .filter((s) => s.score < 80 && s.improvementSuggestion)
    .slice(0, 10)
    .map((s) => `[${s.score}/100] ${s.category} - ${s.item}: ${s.improvementSuggestion}`)
}

function saveScorecard() {
  if (!fs.existsSync(SCORECARD_DIR)) {
    fs.mkdirSync(SCORECARD_DIR, { recursive: true })
  }

  calculateGrades()

  // Save JSON for programmatic access
  fs.writeFileSync(path.join(SCORECARD_DIR, 'report.json'), JSON.stringify(scorecard, null, 2))

  // Save markdown for human reading
  const md = generateMarkdownReport()
  fs.writeFileSync(path.join(SCORECARD_DIR, 'report.md'), md)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 QUALITY SCORECARD: ${scorecard.overallScore}/100`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Features: ${scorecard.grades.features}/100`)
  console.log(`UX: ${scorecard.grades.ux}/100`)
  console.log(`Accessibility: ${scorecard.grades.accessibility}/100`)
  console.log(`Performance: ${scorecard.grades.performance}/100`)
  console.log(`Polish: ${scorecard.grades.polish}/100`)
  console.log(`${'='.repeat(60)}`)

  if (scorecard.improvementPriorities.length > 0) {
    console.log(`\nTop Improvement Priorities:`)
    scorecard.improvementPriorities.slice(0, 5).forEach((p, i) => {
      console.log(`${i + 1}. ${p}`)
    })
  }
}

function generateMarkdownReport(): string {
  const statusEmoji = {
    excellent: '✅',
    good: '👍',
    'needs-work': '⚠️',
    missing: '❌',
    broken: '🔴',
  }

  let md = `# Gather Quality Scorecard

Generated: ${scorecard.timestamp}

## Overall Score: ${scorecard.overallScore}/100

| Category | Score |
|----------|-------|
| Features | ${scorecard.grades.features}/100 |
| UX | ${scorecard.grades.ux}/100 |
| Accessibility | ${scorecard.grades.accessibility}/100 |
| Performance | ${scorecard.grades.performance}/100 |
| Polish | ${scorecard.grades.polish}/100 |

`

  if (scorecard.criticalIssues.length > 0) {
    md += `## 🚨 Critical Issues\n\n`
    scorecard.criticalIssues.forEach((issue) => {
      md += `- ${issue}\n`
    })
    md += '\n'
  }

  if (scorecard.improvementPriorities.length > 0) {
    md += `## 📈 Improvement Priorities\n\n`
    scorecard.improvementPriorities.forEach((p, i) => {
      md += `${i + 1}. ${p}\n`
    })
    md += '\n'
  }

  // Group scores by category
  const byCategory: Record<string, Score[]> = {}
  for (const score of scorecard.scores) {
    if (!byCategory[score.category]) {
      byCategory[score.category] = []
    }
    byCategory[score.category].push(score)
  }

  md += `## Detailed Scores\n\n`
  for (const [category, scores] of Object.entries(byCategory)) {
    md += `### ${category}\n\n`
    md += `| Item | Score | Status | Notes |\n`
    md += `|------|-------|--------|-------|\n`
    for (const score of scores) {
      md += `| ${score.item} | ${score.score} | ${statusEmoji[score.status]} ${score.status} | ${score.notes} |\n`
    }
    md += '\n'
  }

  return md
}

// Force serial execution to accumulate scores properly
test.describe.configure({ mode: 'serial' })

// ============ FEATURE COMPLETENESS ============

test.describe('Features', () => {
  test('core task management', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Can add a task
    const input = page.locator('input[placeholder*="next"], input[placeholder*="Add"]').first()
    const canAddTask = await input.isVisible()

    addScore({
      category: 'Features',
      item: 'Task creation',
      score: canAddTask ? 100 : 0,
      status: canAddTask ? 'excellent' : 'broken',
      notes: canAddTask ? 'Main input visible and accessible' : 'Cannot find task input',
      improvementSuggestion: canAddTask ? undefined : 'Ensure main input is always visible',
    })

    // Create a task and verify AI responds
    if (canAddTask) {
      await input.fill('Test task for quality check')
      await input.press('Enter')
      await page.waitForLoadState('networkidle')

      // Wait for AI card to appear (with thinking or response)
      const aiCard = page.locator('[data-testid="ai-card"], .ai-card')
      let aiResponse = false

      try {
        await aiCard.first().waitFor({ state: 'visible', timeout: 5000 })
        aiResponse = true
      } catch {
        // Fallback: check if any AI-like content appeared
        aiResponse = await page.locator('[aria-busy="true"], text=/understanding|analyzing|looking/i').isVisible().catch(() => false)
      }

      addScore({
        category: 'Features',
        item: 'AI task analysis',
        score: aiResponse ? 100 : 50,
        status: aiResponse ? 'excellent' : 'needs-work',
        notes: aiResponse ? 'AI responds to task input' : 'No AI response visible',
        improvementSuggestion: aiResponse ? undefined : 'Verify AI integration is working',
      })
    }

    await captureState(page, 'scorecard', 'task-creation')
  })

  test('view switching', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check for view toggle
    const viewToggle = page.locator('button[title*="list" i], button[title*="view" i]').first()
    const hasViewToggle = await viewToggle.isVisible().catch(() => false)

    addScore({
      category: 'Features',
      item: 'View switching',
      score: hasViewToggle ? 100 : 60,
      status: hasViewToggle ? 'excellent' : 'needs-work',
      notes: hasViewToggle ? 'View toggle present' : 'No view toggle found',
      improvementSuggestion: hasViewToggle ? undefined : 'Add ability to switch between card and list views',
    })

    await captureState(page, 'scorecard', 'view-toggle')
  })

  test('theme support', async ({ page }) => {
    await enterDemoMode(page)

    // Light mode
    await setTheme(page, 'light')
    await page.waitForTimeout(200)
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    // Dark mode
    await setTheme(page, 'dark')
    await page.waitForTimeout(200)
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    const themeWorks = lightBg !== darkBg

    addScore({
      category: 'Features',
      item: 'Dark mode',
      score: themeWorks ? 100 : 0,
      status: themeWorks ? 'excellent' : 'broken',
      notes: themeWorks ? 'Theme switching works correctly' : 'Theme does not change',
      improvementSuggestion: themeWorks ? undefined : 'Fix theme toggle functionality',
    })

    await captureState(page, 'scorecard', 'theme-support')
  })
})

// ============ UX QUALITY ============

test.describe('UX', () => {
  test('empty state experience', async ({ page }) => {
    // Mock time to afternoon for consistent "open" / "add something whenever" state
    await setMockTime(page, 14)
    await page.goto('/')
    await page.getByRole('button', { name: /try the demo/i }).click()
    await page.waitForLoadState('networkidle')

    // Get visible text AND placeholder attributes
    const texts = await extractVisibleText(page)
    const placeholders = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[placeholder]')
      return Array.from(inputs).map((i) => i.getAttribute('placeholder') || '')
    })

    const allText = [...texts, ...placeholders].join(' ').toLowerCase()

    // Check for welcoming empty state
    // "open" from time-of-day, "next" from "What's next?" placeholder
    const hasWelcome = /ready|open|next|add|start|here|waiting/.test(allText)
    // "what" from "What's next?", "something" from "add something whenever"
    const hasGuidance = /what|task|help|something/.test(allText)

    const score = (hasWelcome ? 50 : 0) + (hasGuidance ? 50 : 0)

    addScore({
      category: 'UX',
      item: 'Empty state warmth',
      score,
      status: score >= 80 ? 'excellent' : score >= 50 ? 'good' : 'needs-work',
      notes: `Welcome: ${hasWelcome}, Guidance: ${hasGuidance}`,
      improvementSuggestion:
        score < 80 ? 'Add warmer, more inviting empty state copy that guides users' : undefined,
    })

    await captureState(page, 'scorecard', 'empty-state')
  })

  test('loading feedback', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[placeholder*="next"], input[placeholder*="Add"]').first()
    await input.fill('test loading feedback')

    await input.press('Enter')

    // Wait for loading indicator to appear (AI card with aria-busy or loading class)
    const loadingIndicator = page.locator('[aria-busy="true"], .loading-indicator, .animate-pulse, [class*="thinking"]')
    let loadingFound = false

    try {
      await loadingIndicator.first().waitFor({ state: 'visible', timeout: 3000 })
      loadingFound = true
    } catch {
      // Check if any element appeared that indicates processing
      const aiCard = page.locator('[class*="AICard"], [class*="ai-card"]').first()
      loadingFound = await aiCard.isVisible().catch(() => false)
    }

    addScore({
      category: 'UX',
      item: 'Loading feedback',
      score: loadingFound ? 100 : 40,
      status: loadingFound ? 'excellent' : 'needs-work',
      notes: loadingFound ? 'Loading indicator shown during async operations' : 'No loading indicator detected',
      improvementSuggestion: loadingFound
        ? undefined
        : 'Add visible loading states for all async operations (spinner, skeleton, or pulse animation)',
    })
  })

  test('error recovery', async ({ page, context }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Simulate offline
    await context.setOffline(true)

    const input = page.locator('input[placeholder*="next"], input[placeholder*="Add"]').first()
    await input.fill('offline test')
    await input.press('Enter')
    await page.waitForTimeout(2000)

    // Check for error handling
    const hasErrorUI =
      (await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false)) ||
      (await page.locator('text=/try again|retry|couldn\'t/i').isVisible().catch(() => false))

    // Check for recovery option
    const hasRecoveryOption = await page.locator('button:has-text("retry"), button:has-text("try again")').isVisible().catch(() => false)

    await context.setOffline(false)

    const score = (hasErrorUI ? 50 : 0) + (hasRecoveryOption ? 50 : 0)

    addScore({
      category: 'UX',
      item: 'Error recovery',
      score,
      status: score >= 80 ? 'excellent' : score >= 50 ? 'good' : 'needs-work',
      notes: `Error shown: ${hasErrorUI}, Recovery option: ${hasRecoveryOption}`,
      improvementSuggestion: score < 80 ? 'Ensure all errors show clear recovery options' : undefined,
    })

    await captureState(page, 'scorecard', 'error-handling')
  })
})

// ============ ACCESSIBILITY ============

test.describe('Accessibility', () => {
  test('WCAG compliance', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const results = await auditAccessibility(page)

    const criticalCount = results.violations.filter((v) => v.impact === 'critical').length
    const seriousCount = results.violations.filter((v) => v.impact === 'serious').length

    let score = 100
    score -= criticalCount * 30
    score -= seriousCount * 15
    score = Math.max(0, score)

    addScore({
      category: 'Accessibility',
      item: 'WCAG 2.1 AA',
      score,
      status: score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'needs-work' : 'broken',
      notes: `${results.passes} passed, ${results.violations.length} violations (${criticalCount} critical, ${seriousCount} serious)`,
      improvementSuggestion:
        results.violations.length > 0
          ? `Fix: ${results.violations.slice(0, 3).map((v) => v.id).join(', ')}`
          : undefined,
    })
  })

  test('keyboard navigation', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    let reachedInput = false
    let focusVisible = 0

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)

      const focused = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return { isInput: false, hasFocus: false }

        const style = getComputedStyle(el)
        const hasFocus =
          style.outlineWidth !== '0px' || style.boxShadow !== 'none' || el.classList.toString().includes('focus')

        return {
          isInput: el.tagName === 'INPUT',
          hasFocus,
        }
      })

      if (focused.isInput) reachedInput = true
      if (focused.hasFocus) focusVisible++
    }

    const score = (reachedInput ? 50 : 0) + Math.min(50, focusVisible * 10)

    addScore({
      category: 'Accessibility',
      item: 'Keyboard navigation',
      score,
      status: score >= 80 ? 'excellent' : score >= 50 ? 'good' : 'needs-work',
      notes: `Can reach input: ${reachedInput}, Focus visible on ${focusVisible}/10 elements`,
      improvementSuggestion:
        score < 80 ? 'Ensure all interactive elements have visible focus indicators and logical tab order' : undefined,
    })
  })
})

// ============ PERFORMANCE ============

test.describe('Performance', () => {
  test('Core Web Vitals', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const metrics = await capturePerformanceMetrics(page)

    // LCP scoring (good < 2500, needs improvement < 4000)
    let lcpScore = 100
    if (metrics.lcp) {
      if (metrics.lcp > 4000) lcpScore = 30
      else if (metrics.lcp > 2500) lcpScore = 60
    }

    addScore({
      category: 'Performance',
      item: 'LCP (Largest Contentful Paint)',
      score: lcpScore,
      status: lcpScore >= 80 ? 'excellent' : lcpScore >= 60 ? 'good' : 'needs-work',
      notes: `${metrics.lcp || 'N/A'}ms`,
      improvementSuggestion: lcpScore < 80 ? 'Optimize images, reduce render-blocking resources' : undefined,
    })

    // CLS scoring (good < 0.1, needs improvement < 0.25)
    let clsScore = 100
    if (metrics.cls !== null) {
      if (metrics.cls > 0.25) clsScore = 30
      else if (metrics.cls > 0.1) clsScore = 60
    }

    addScore({
      category: 'Performance',
      item: 'CLS (Cumulative Layout Shift)',
      score: clsScore,
      status: clsScore >= 80 ? 'excellent' : clsScore >= 60 ? 'good' : 'needs-work',
      notes: `${metrics.cls}`,
      improvementSuggestion: clsScore < 80 ? 'Set explicit dimensions on images/embeds, avoid inserting content above existing content' : undefined,
    })

    // FCP scoring (good < 1800)
    let fcpScore = 100
    if (metrics.fcp) {
      if (metrics.fcp > 3000) fcpScore = 30
      else if (metrics.fcp > 1800) fcpScore = 60
    }

    addScore({
      category: 'Performance',
      item: 'FCP (First Contentful Paint)',
      score: fcpScore,
      status: fcpScore >= 80 ? 'excellent' : fcpScore >= 60 ? 'good' : 'needs-work',
      notes: `${metrics.fcp || 'N/A'}ms`,
      improvementSuggestion: fcpScore < 80 ? 'Reduce server response time, eliminate render-blocking resources' : undefined,
    })
  })

  test('interaction responsiveness', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[placeholder*="next"], input[placeholder*="Add"]').first()

    // Measure typing latency
    const start = Date.now()
    await input.type('test', { delay: 0 })
    const typingLatency = Date.now() - start

    // Should be very fast for 4 characters
    const score = typingLatency < 100 ? 100 : typingLatency < 200 ? 80 : typingLatency < 500 ? 50 : 20

    addScore({
      category: 'Performance',
      item: 'Input responsiveness',
      score,
      status: score >= 80 ? 'excellent' : score >= 50 ? 'good' : 'needs-work',
      notes: `Typing 4 chars took ${typingLatency}ms`,
      improvementSuggestion: score < 80 ? 'Optimize input handling, debounce heavy operations' : undefined,
    })
  })
})

// ============ POLISH ============

test.describe('Polish', () => {
  test('animation smoothness', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check for CSS transitions defined
    const hasTransitions = await page.evaluate(() => {
      const elements = document.querySelectorAll('*')
      let transitionCount = 0
      for (const el of elements) {
        const style = getComputedStyle(el)
        if (style.transition && style.transition !== 'none' && style.transition !== 'all 0s ease 0s') {
          transitionCount++
        }
      }
      return transitionCount
    })

    const score = hasTransitions > 20 ? 100 : hasTransitions > 10 ? 80 : hasTransitions > 5 ? 60 : 40

    addScore({
      category: 'Polish',
      item: 'Animation coverage',
      score,
      status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs-work',
      notes: `${hasTransitions} elements have transitions defined`,
      improvementSuggestion: score < 80 ? 'Add smooth transitions to interactive elements (buttons, cards, modals)' : undefined,
    })
  })

  test('visual consistency', async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check for consistent border-radius usage
    const borderRadii = await page.evaluate(() => {
      const radii = new Set<string>()
      const elements = document.querySelectorAll('*')
      for (const el of elements) {
        const style = getComputedStyle(el)
        if (style.borderRadius && style.borderRadius !== '0px') {
          radii.add(style.borderRadius)
        }
      }
      return Array.from(radii)
    })

    // Good design systems use limited border-radius values
    const score = borderRadii.length <= 6 ? 100 : borderRadii.length <= 10 ? 80 : borderRadii.length <= 15 ? 60 : 40

    addScore({
      category: 'Polish',
      item: 'Design consistency',
      score,
      status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs-work',
      notes: `${borderRadii.length} unique border-radius values`,
      improvementSuggestion:
        score < 80 ? 'Standardize border-radius values to design system tokens (6px, 10px, 12px, 16px, 20px)' : undefined,
    })
  })

  test('mobile experience', async ({ page }) => {
    await setViewport(page, 'mobile')
    await enterDemoMode(page)
    await page.waitForLoadState('networkidle')

    // Check main input is usable
    const input = page.locator('input[placeholder*="next"], input[placeholder*="Add"]').first()
    const inputVisible = await input.isVisible()

    // Check no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )

    // Check touch targets
    const smallButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button')
      let small = 0
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect()
        if (rect.width < 44 || rect.height < 44) small++
      }
      return small
    })

    const score = (inputVisible ? 40 : 0) + (hasHorizontalScroll ? 0 : 30) + (smallButtons === 0 ? 30 : smallButtons < 3 ? 20 : 0)

    addScore({
      category: 'Polish',
      item: 'Mobile experience',
      score,
      status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs-work',
      notes: `Input visible: ${inputVisible}, H-scroll: ${hasHorizontalScroll}, Small buttons: ${smallButtons}`,
      improvementSuggestion:
        score < 80
          ? 'Ensure all touch targets are 44x44px minimum, no horizontal scroll, input always accessible'
          : undefined,
    })

    await captureState(page, 'scorecard', 'mobile')
  })
})

// ============ GENERATE FINAL REPORT ============

test.afterAll(() => {
  saveScorecard()
})
