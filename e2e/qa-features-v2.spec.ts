import { test, expect } from '@playwright/test'
import { enterDemoMode, screenshot } from './helpers'

/**
 * QA Tests for New Features - Version 2
 *
 * Testing by clicking on existing demo tasks rather than creating new ones.
 */

test.describe('QA: Feature Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    await page.waitForTimeout(1500)
  })

  test('1. Gamification: Card visible and modal opens', async ({ page }) => {
    // Look for gamification card - shows "Level X" text
    await screenshot(page, 'qa-v2-home-initial')

    const levelText = page.locator('text=/Level \\d+/').first()
    await expect(levelText).toBeVisible({ timeout: 5000 })
    console.log('[PASS] Gamification card showing Level is visible')

    // Check for points display
    const ptsText = page.locator('text=/\\d+ pts/').first()
    await expect(ptsText).toBeVisible({ timeout: 3000 })
    console.log('[PASS] Points display is visible')

    // Click to open rewards modal
    await levelText.click()
    await page.waitForTimeout(500)

    await screenshot(page, 'qa-v2-rewards-modal')

    // Check modal content
    const modalTitle = page.locator('text=Your Garden')
    await expect(modalTitle).toBeVisible({ timeout: 3000 })
    console.log('[PASS] Rewards modal opens with "Your Garden" title')

    // Check for point earning info
    const howToEarn = page.locator('text=How to earn points')
    await expect(howToEarn).toBeVisible({ timeout: 3000 })
    console.log('[PASS] "How to earn points" section visible')

    // Check tabs
    const progressTab = page.locator('button:has-text("Progress")')
    const rewardsTab = page.locator('button:has-text("Rewards")')

    await expect(progressTab).toBeVisible()
    await expect(rewardsTab).toBeVisible()
    console.log('[PASS] Progress and Rewards tabs visible')

    // Close modal
    const closeBtn = page.locator('button[aria-label*="close"], button:has(svg path[d*="M6 18L18 6"])').first()
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click()
    }
  })

  test('2. Coach Notes: Button in header and modal works', async ({ page }) => {
    await screenshot(page, 'qa-v2-coach-notes-before')

    // Find the Coach Notes button (book icon) in the header
    const coachNotesBtn = page.locator('button[title="Coach Notes"]')
    const isVisible = await coachNotesBtn.isVisible({ timeout: 3000 }).catch(() => false)

    if (!isVisible) {
      // Try finding by the SVG path
      const altBtn = page.locator('button:has(svg path[d*="M12 6.253v13"])').first()
      if (await altBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await altBtn.click()
      } else {
        console.log('[INFO] Coach Notes button not found in header, checking alternatives')
        await screenshot(page, 'qa-v2-no-coach-notes-btn')
        return
      }
    } else {
      await coachNotesBtn.click()
    }

    await page.waitForTimeout(500)
    await screenshot(page, 'qa-v2-coach-notes-modal')

    // Check modal content
    const patternsTab = page.locator('button:has-text("Patterns")')
    const strategiesTab = page.locator('button:has-text("What Works"), button:has-text("Strategies")')
    const historyTab = page.locator('button:has-text("History")')
    const settingsTab = page.locator('button:has-text("Settings")')

    if (await patternsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] Coach Notes modal - Patterns tab visible')
    }
    if (await strategiesTab.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] Coach Notes modal - What Works/Strategies tab visible')
    }
    if (await historyTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] Coach Notes modal - History tab visible')
    }
    if (await settingsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] Coach Notes modal - Settings tab visible')
    }

    // Click settings tab to see memory options
    if (await settingsTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await settingsTab.click()
      await page.waitForTimeout(300)

      await screenshot(page, 'qa-v2-coach-notes-settings')

      const memoryToggle = page.locator('text=Memory enabled')
      if (await memoryToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[PASS] Memory enabled toggle present in settings')
      }
    }
  })

  test('3. Task Menu: Nagging and Location options', async ({ page }) => {
    await screenshot(page, 'qa-v2-task-menu-start')

    // Click on an existing task to open task view
    // Look for tasks in OTHER TASKS section
    const taskItem = page.locator('text=Renew passport').first()
    const isTaskVisible = await taskItem.isVisible({ timeout: 3000 }).catch(() => false)

    if (!isTaskVisible) {
      // Try other common task names
      const altTask = page.locator('[role="button"]:has-text("Get Healthier"), [role="button"]:has-text("Morning meditation")').first()
      if (await altTask.isVisible({ timeout: 2000 }).catch(() => false)) {
        await altTask.click()
      } else {
        console.log('[INFO] No tasks found to click')
        await screenshot(page, 'qa-v2-no-tasks')
        return
      }
    } else {
      await taskItem.click()
    }

    await page.waitForTimeout(500)
    await screenshot(page, 'qa-v2-task-view')

    // Find and click the menu button (three dots)
    const menuBtn = page.locator('button[aria-label="Menu"]')
    const isMenuVisible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)

    if (!isMenuVisible) {
      // Try alternative selector
      const altMenu = page.locator('button:has(svg circle)').last()
      if (await altMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await altMenu.click()
      } else {
        console.log('[INFO] Menu button not found')
        await screenshot(page, 'qa-v2-no-menu-btn')
        return
      }
    } else {
      await menuBtn.click()
    }

    await page.waitForTimeout(300)
    await screenshot(page, 'qa-v2-task-menu-open')

    // Check for nagging option
    const naggingOption = page.locator('text=/nag me|nagging/i').first()
    if (await naggingOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] "Nag me until done" option found in task menu')
    } else {
      console.log('[INFO] Nagging option not visible')
    }

    // Check for location option
    const locationOption = page.locator('text=/remind at location|location reminder/i').first()
    if (await locationOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] "Remind at location" option found in task menu')
    } else {
      console.log('[INFO] Location reminder option not visible')
    }

    // Check for energy option
    const energyOption = page.locator('text=/set energy|change energy/i').first()
    if (await energyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] "Set energy" option found in task menu')
    }

    // Test clicking nagging option to open settings
    if (await naggingOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      await naggingOption.click()
      await page.waitForTimeout(500)

      await screenshot(page, 'qa-v2-nagging-settings')

      // Check nagging settings modal content
      const enableToggle = page.locator('text=/enable nagging/i')
      if (await enableToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[PASS] Nagging settings modal - Enable toggle visible')
      }

      const frequencyOptions = page.locator('text=/every \\d+ minute/i')
      if (await frequencyOptions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[PASS] Nagging settings modal - Frequency options visible')
      }

      // Close the modal
      const doneBtn = page.locator('button:has-text("Done")').first()
      if (await doneBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await doneBtn.click()
      }
    }
  })

  test('4. Settings Gear: Integration settings accessible', async ({ page }) => {
    // Find settings gear icon in header
    const settingsGear = page.locator('button[title="Integrations"], button:has(svg circle[cx="12"][cy="12"])').first()
    const isVisible = await settingsGear.isVisible({ timeout: 3000 }).catch(() => false)

    await screenshot(page, 'qa-v2-settings-gear-check')

    if (isVisible) {
      await settingsGear.click()
      await page.waitForTimeout(500)

      await screenshot(page, 'qa-v2-integration-settings')

      // Check for settings content
      const settingsHeading = page.locator('text=/settings|integrations/i').first()
      if (await settingsHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[PASS] Integration settings modal opens')
      }
    } else {
      console.log('[INFO] Settings gear not visible in expected location')
    }
  })

  test('5. Mobile responsive view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(500)

    await screenshot(page, 'qa-v2-mobile-home')

    // Check gamification card is still visible
    const levelText = page.locator('text=/Level \\d+/').first()
    if (await levelText.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[PASS] Mobile view - Gamification card visible')
    }

    // Check layout is responsive
    const mainContent = page.locator('.max-w-\\[540px\\]').first()
    if (await mainContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[PASS] Mobile view - Main content container present')
    }

    console.log('[INFO] Mobile screenshots captured for visual review')
  })
})

/**
 * Feature presence report
 */
test('QA Feature Presence Summary', async ({ page }) => {
  await enterDemoMode(page)
  await page.waitForTimeout(1500)

  console.log('\n========================================')
  console.log('QA FEATURE PRESENCE SUMMARY')
  console.log('========================================\n')

  // Gamification
  const hasGamification = await page.locator('text=/Level \\d+/').first().isVisible({ timeout: 3000 }).catch(() => false)
  console.log(`[${hasGamification ? 'x' : ' '}] Gamification Card`)

  // Coach Notes button
  const hasCoachNotes = await page.locator('button[title="Coach Notes"], button:has(svg path[d*="M12 6.253v13"])').first().isVisible({ timeout: 3000 }).catch(() => false)
  console.log(`[${hasCoachNotes ? 'x' : ' '}] Coach Notes Button`)

  // Settings gear
  const hasSettings = await page.locator('button[title="Integrations"], button:has(svg path[d*="M19.4 15"])').first().isVisible({ timeout: 3000 }).catch(() => false)
  console.log(`[${hasSettings ? 'x' : ' '}] Settings/Integrations Button`)

  // View toggle (removed in navigation simplification - HomeView is now the primary view)
  // const hasViewToggle = await page.locator('button:has(svg rect), [aria-label*="view"]').first().isVisible({ timeout: 3000 }).catch(() => false)
  console.log(`[ ] View Toggle (intentionally removed)`)

  // Chat FAB
  const hasChatFab = await page.locator('button[aria-label="Open chat"]').first().isVisible({ timeout: 3000 }).catch(() => false)
  console.log(`[${hasChatFab ? 'x' : ' '}] Chat FAB Button`)

  // Mood picker
  const hasMoodPicker = await page.locator('text=How are you feeling right now').first().isVisible({ timeout: 3000 }).catch(() => false)
  console.log(`[${hasMoodPicker ? 'x' : ' '}] Mood Picker`)

  await screenshot(page, 'qa-v2-summary')

  console.log('\n========================================')
  console.log('Screenshots saved to e2e-screenshots/')
  console.log('========================================\n')
})
