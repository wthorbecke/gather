import { test, expect } from '@playwright/test'
import { enterDemoMode, screenshot } from './helpers'

/**
 * Energy Level Filter Tests
 *
 * Tests for the quick filter buttons that filter tasks by energy level.
 * The filter should display: All, High, Medium, Low buttons.
 * Note: EnergyFilter is in StackView, so we need to switch to stack view first.
 */

/**
 * Switch to stack view
 * Note: ViewToggle has been removed from the UI as part of navigation simplification.
 * Stack view is now only accessible via the "Focus" mode (JustOneThing) or programmatically.
 * These tests are skipped until the energy filter is moved to HomeView or accessible elsewhere.
 */
async function switchToStackView(page: import('@playwright/test').Page) {
  // ViewToggle removed - Stack view is now only accessible via Focus button
  // which launches JustOneThing mode, not the full StackView
  throw new Error('StackView not accessible - ViewToggle removed')
}

// Skip these tests - ViewToggle removed, StackView needs alternative entry point
test.describe.skip('Energy Filter', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    // Switch to stack view where the energy filter is located
    await switchToStackView(page)
    await page.waitForTimeout(500)
  })

  test('displays all energy filter buttons', async ({ page }) => {
    // Should see all four filter buttons
    await expect(page.getByTestId('energy-filter-all')).toBeVisible()
    await expect(page.getByTestId('energy-filter-high')).toBeVisible()
    await expect(page.getByTestId('energy-filter-medium')).toBeVisible()
    await expect(page.getByTestId('energy-filter-low')).toBeVisible()

    await screenshot(page, 'energy-filter-buttons')
  })

  test('All filter is selected by default', async ({ page }) => {
    const allButton = page.getByTestId('energy-filter-all')

    // Check that All filter has the selected styling (accent background)
    await expect(allButton).toHaveAttribute('aria-checked', 'true')

    // Other buttons should not be selected
    await expect(page.getByTestId('energy-filter-high')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('energy-filter-medium')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('energy-filter-low')).toHaveAttribute('aria-checked', 'false')
  })

  test('clicking a filter button selects it', async ({ page }) => {
    // Click the High energy filter
    await page.getByTestId('energy-filter-high').click()
    await page.waitForTimeout(200)

    // High should be selected
    await expect(page.getByTestId('energy-filter-high')).toHaveAttribute('aria-checked', 'true')

    // All should no longer be selected
    await expect(page.getByTestId('energy-filter-all')).toHaveAttribute('aria-checked', 'false')

    await screenshot(page, 'energy-filter-high-selected')
  })

  test('can switch between different filters', async ({ page }) => {
    // Start with All selected
    await expect(page.getByTestId('energy-filter-all')).toHaveAttribute('aria-checked', 'true')

    // Click Medium
    await page.getByTestId('energy-filter-medium').click()
    await page.waitForTimeout(200)
    await expect(page.getByTestId('energy-filter-medium')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('energy-filter-all')).toHaveAttribute('aria-checked', 'false')

    // Click Low
    await page.getByTestId('energy-filter-low').click()
    await page.waitForTimeout(200)
    await expect(page.getByTestId('energy-filter-low')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('energy-filter-medium')).toHaveAttribute('aria-checked', 'false')

    // Click back to All
    await page.getByTestId('energy-filter-all').click()
    await page.waitForTimeout(200)
    await expect(page.getByTestId('energy-filter-all')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('energy-filter-low')).toHaveAttribute('aria-checked', 'false')
  })

  test('filter buttons have correct labels with emojis', async ({ page }) => {
    // Check button text content
    await expect(page.getByTestId('energy-filter-all')).toContainText('All')
    await expect(page.getByTestId('energy-filter-high')).toContainText('High')
    await expect(page.getByTestId('energy-filter-medium')).toContainText('Medium')
    await expect(page.getByTestId('energy-filter-low')).toContainText('Low')
  })

  test('filter has proper accessibility attributes', async ({ page }) => {
    // Check that the filter group has role="radiogroup"
    const filterGroup = page.locator('[role="radiogroup"]')
    await expect(filterGroup).toBeVisible()
    await expect(filterGroup).toHaveAttribute('aria-label', 'Filter tasks by energy level')

    // Check that buttons have role="radio"
    const allButton = page.getByTestId('energy-filter-all')
    await expect(allButton).toHaveAttribute('role', 'radio')
  })
})

// Skip these tests - ViewToggle removed, StackView needs alternative entry point
test.describe.skip('Energy Filter - Task Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    // Switch to stack view where the energy filter is located
    await switchToStackView(page)
    await page.waitForTimeout(500)
  })

  test('filtering by energy level updates the visible cards', async ({ page }) => {
    // In demo mode, we should have tasks with different energy levels
    // The demo starter tasks have: File taxes (high), Renew passport (low),
    // Get healthier (medium), Morning meditation (low)

    // Get initial card count (or check if there are cards)
    const hasCards = await page.locator('[class*="rounded-[24px]"]').first().isVisible({ timeout: 2000 }).catch(() => false)

    if (hasCards) {
      // Filter by High energy
      await page.getByTestId('energy-filter-high').click()
      await page.waitForTimeout(300)
      await screenshot(page, 'energy-filter-high-tasks')

      // Filter by Low energy
      await page.getByTestId('energy-filter-low').click()
      await page.waitForTimeout(300)
      await screenshot(page, 'energy-filter-low-tasks')

      // Go back to All
      await page.getByTestId('energy-filter-all').click()
      await page.waitForTimeout(300)
      await screenshot(page, 'energy-filter-all-tasks')
    }
  })
})
