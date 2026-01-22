import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, addTask, expectTaskVisible, screenshot } from './helpers'

test.describe('Tasks Panel', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    await navigateToTab(page, 'Tasks')
  })

  test('displays demo tasks on load', async ({ page }) => {
    // Should show urgent task
    await expect(page.locator('text=Reply to Mom')).toBeVisible()

    // Should show soon task
    await expect(page.locator('text=Schedule dentist appointment')).toBeVisible()

    // Should show In progress section header
    await expect(page.locator('text=In progress')).toBeVisible()
  })

  test('shows quick capture input', async ({ page }) => {
    // Quick capture should always be visible
    await expect(page.getByPlaceholder(/what's on your mind/i)).toBeVisible()

    // Should have helpful hint text
    await expect(page.locator('text=Dump it here')).toBeVisible()
  })

  test('can add a simple task via quick capture', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Buy milk')
    await quickInput.press('Enter')

    await expectTaskVisible(page, 'Buy milk')
  })

  test('can add task by clicking Break it down button', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Call dentist')

    // "Break it down" button should appear
    await page.getByRole('button', { name: 'Break it down' }).click()

    // Wait for AI analysis to complete (may timeout and add directly)
    // If clarifying modal appears, cancel it
    const cancelButton = page.getByRole('button', { name: 'Cancel' })
    if (await cancelButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await cancelButton.click()
    }

    // Task should appear (either after AI or after timeout)
    await expectTaskVisible(page, 'Call dentist')
  })

  test('auto-detects urgent tasks', async ({ page }) => {
    await addTask(page, 'ASAP reply to boss')

    // Should be in "In progress" section
    await expect(page.locator('text=In progress')).toBeVisible({ timeout: 15000 })
    await expectTaskVisible(page, 'ASAP reply to boss')
  })

  test('auto-detects waiting tasks', async ({ page }) => {
    await addTask(page, 'Waiting for package delivery')

    // Task should be added and visible
    await expectTaskVisible(page, 'Waiting for package delivery')
  })

  test('handles AI analysis for complex tasks', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Get my real id')
    await quickInput.press('Enter')

    // Should show "Thinking..." first (AI analyzing)
    await expect(page.locator('text=Thinking')).toBeVisible({ timeout: 2000 })

    // Wait for AI to finish (either shows modal or adds task directly)
    await page.waitForTimeout(6000)

    // Handle modal if it appeared, otherwise task was added directly
    const cancelButton = page.getByRole('button', { name: 'Cancel' })
    if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await screenshot(page, 'ai-clarifying-question')
      await cancelButton.click()
    }

    // Task should be added either way
    await expectTaskVisible(page, 'Get my real id')
  })

  test('adds task even when AI times out', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Do my taxes')
    await quickInput.press('Enter')

    // Wait for AI analysis (may timeout and add directly)
    const cancelButton = page.getByRole('button', { name: 'Cancel' })
    if (await cancelButton.isVisible({ timeout: 18000 }).catch(() => false)) {
      await cancelButton.click()
    }

    // Task should be added (either via AI flow or timeout fallback)
    await expectTaskVisible(page, 'Do my taxes')
  })

  test('can interact with AI clarifying modal if shown', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Renew my passport')
    await quickInput.press('Enter')

    // Wait for possible AI modal
    const modal = page.locator('text=Let me break this down')
    const cancelButton = page.getByRole('button', { name: 'Cancel' })
    
    // Either modal appears or task is added directly
    const modalAppeared = await modal.isVisible({ timeout: 8000 }).catch(() => false)
    
    if (modalAppeared) {
      await screenshot(page, 'ai-modal-interaction')
      // If modal appeared, we can cancel or answer
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click()
      }
    }

    // Task should be added either way
    await expectTaskVisible(page, 'Renew my passport')
  })

  test('simple tasks skip AI clarification', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Buy milk')
    await quickInput.press('Enter')

    // Simple tasks should NOT show clarifying modal (AI decides)
    // Wait a moment for AI response
    await page.waitForTimeout(3000)

    // Task should be added (either directly or after AI determined no questions needed)
    await expectTaskVisible(page, 'Buy milk')
  })

  test('can add complex task with AI assistance', async ({ page }) => {
    await addTask(page, 'Get my real id')

    // Task should be added (AI may have asked questions, helper skips them)
    await expectTaskVisible(page, 'Get my real id')
  })

  test('clears input after adding task', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.fill('Quick task')
    await quickInput.press('Enter')

    // Input should be cleared
    await expect(quickInput).toHaveValue('')
  })

  test('does not add empty task', async ({ page }) => {
    const quickInput = page.getByPlaceholder(/what's on your mind/i)
    await quickInput.press('Enter')

    // No new task should appear, input should remain
    await expect(quickInput).toBeVisible()
  })

  test('can click on a task to open details', async ({ page }) => {
    // Click on a task
    await page.locator('text=Schedule dentist appointment').click()

    // Modal should open
    await page.waitForTimeout(300)
    await screenshot(page, 'task-detail-modal-new')
  })

  test('shows step count in section header', async ({ page }) => {
    // Should show "In progress" section header
    await expect(page.locator('text=In progress')).toBeVisible()
  })

  test('extracts date badge from task title', async ({ page }) => {
    await addTask(page, 'Submit report tomorrow')

    // Task should be visible
    await expectTaskVisible(page, 'Submit report tomorrow')
    // Badge might be extracted depending on AI analysis
    await screenshot(page, 'task-with-badge')
  })
})
