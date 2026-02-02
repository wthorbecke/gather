import { test, expect } from '@playwright/test'
import {
  loginAsTestUser,
  setupApiErrorMonitoring,
  canRunAuthenticatedTests,
  screenshot,
} from './helpers'

/**
 * Chat Modal Tests
 *
 * Tests for the new free-form chat interface that allows
 * natural conversation with AI for task creation.
 */

test.describe('Chat Modal', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured (TEST_USER_EMAIL, TEST_USER_PASSWORD)')
    }
  })

  test('chat FAB button is visible', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Should see the chat floating action button
    const chatButton = page.getByRole('button', { name: /open chat/i })
    await expect(chatButton).toBeVisible()

    await screenshot(page, 'chat-fab-visible')

    apiMonitor.expectNoErrors()
  })

  test('clicking chat FAB opens modal', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Click the chat FAB
    await page.getByRole('button', { name: /open chat/i }).click()

    // Should see the chat modal
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible()

    // Should see the input placeholder
    await expect(page.getByPlaceholder(/what do you need to do/i)).toBeVisible()

    // Should see close button
    await expect(page.getByRole('button', { name: /close chat/i })).toBeVisible()

    await screenshot(page, 'chat-modal-open')

    apiMonitor.expectNoErrors()
  })

  test('chat modal shows empty state message', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Open chat
    await page.getByRole('button', { name: /open chat/i }).click()

    // Should see empty state message
    await expect(page.locator('text=Tell me what you need to do')).toBeVisible()

    apiMonitor.expectNoErrors()
  })

  test('can close chat modal with X button', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Open chat
    await page.getByRole('button', { name: /open chat/i }).click()
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible()

    // Close chat
    await page.getByRole('button', { name: /close chat/i }).click()

    // Modal should be gone
    await expect(page.getByRole('heading', { name: 'Chat' })).not.toBeVisible()

    apiMonitor.expectNoErrors()
  })

  test('can type a message in chat input', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Open chat
    await page.getByRole('button', { name: /open chat/i }).click()

    // Type a message
    const input = page.getByPlaceholder(/what do you need to do/i)
    await input.fill('I need to call the doctor')

    // Should see the text in input
    await expect(input).toHaveValue('I need to call the doctor')

    // Send button should be enabled
    const sendButton = page.getByRole('button', { name: /send message/i })
    await expect(sendButton).toBeEnabled()

    await screenshot(page, 'chat-input-typed')

    apiMonitor.expectNoErrors()
  })

  test('send button is disabled when input is empty', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Open chat
    await page.getByRole('button', { name: /open chat/i }).click()

    // Send button should be disabled
    const sendButton = page.getByRole('button', { name: /send message/i })
    await expect(sendButton).toBeDisabled()

    apiMonitor.expectNoErrors()
  })

  test('can send a message and see it in the chat', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Open chat
    await page.getByRole('button', { name: /open chat/i }).click()

    // Type and send a message
    const input = page.getByPlaceholder(/what do you need to do/i)
    await input.fill('Hello, I need help')
    await page.getByRole('button', { name: /send message/i }).click()

    // Should see user message in chat
    await expect(page.locator('text=Hello, I need help')).toBeVisible()

    // Input should be cleared
    await expect(input).toHaveValue('')

    await screenshot(page, 'chat-message-sent')

    // Note: We don't wait for AI response as it requires valid API keys
    // In CI without keys, this just verifies the UI flow works

    apiMonitor.expectNoErrors()
  })

  test('can send message with Enter key', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Open chat
    await page.getByRole('button', { name: /open chat/i }).click()

    // Type a message and press Enter
    const input = page.getByPlaceholder(/what do you need to do/i)
    await input.fill('Test message via Enter')
    await input.press('Enter')

    // Should see user message
    await expect(page.locator('text=Test message via Enter')).toBeVisible()

    apiMonitor.expectNoErrors()
  })

  test('Shift+Enter adds newline instead of sending', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)

    await loginAsTestUser(page)

    // Open chat
    await page.getByRole('button', { name: /open chat/i }).click()

    // Type and press Shift+Enter
    const input = page.getByPlaceholder(/what do you need to do/i)
    await input.fill('Line 1')
    await input.press('Shift+Enter')
    await input.type('Line 2')

    // Should have both lines in input (not sent)
    const value = await input.inputValue()
    expect(value).toContain('Line 1')
    expect(value).toContain('Line 2')

    // Message should NOT appear as a chat bubble (user messages have specific styling)
    // The text is in the input, not as a sent message bubble
    const userBubble = page.locator('[class*="bg-accent"][class*="text-white"] >> text=Line 1')
    await expect(userBubble).not.toBeVisible()

    apiMonitor.expectNoErrors()
  })
})
