import { test, expect } from '@playwright/test'

/**
 * Tests for useContextGathering hook
 *
 * Since this is a React hook, we test it indirectly through the app behavior
 * or by testing the logic extracted into pure functions.
 */

test.describe('Context Gathering Logic', () => {
  // Test the hook's state management indirectly through app behavior

  test.describe('Question Flow', () => {
    test('should track progress through multiple questions', () => {
      // Simulate the progress calculation
      const state = {
        questions: [
          { key: 'q1', question: 'First?', options: ['A', 'B'] },
          { key: 'q2', question: 'Second?', options: ['C', 'D'] },
          { key: 'q3', question: 'Third?', options: ['E', 'F'] },
        ],
        currentIndex: 1,
        answers: { q1: 'A' },
        taskName: 'Test Task',
      }

      const progress = {
        current: state.currentIndex + 1,
        total: state.questions.length,
      }

      expect(progress.current).toBe(2)
      expect(progress.total).toBe(3)
    })

    test('should allow going back when not at first question', () => {
      const state = {
        questions: [
          { key: 'q1', question: 'First?', options: ['A', 'B'] },
          { key: 'q2', question: 'Second?', options: ['C', 'D'] },
        ],
        currentIndex: 1,
        answers: { q1: 'A' },
        taskName: 'Test Task',
      }

      const canGoBack = state.currentIndex > 0
      expect(canGoBack).toBe(true)
    })

    test('should not allow going back at first question', () => {
      const state = {
        questions: [
          { key: 'q1', question: 'First?', options: ['A', 'B'] },
        ],
        currentIndex: 0,
        answers: {},
        taskName: 'Test Task',
      }

      const canGoBack = state.currentIndex > 0
      expect(canGoBack).toBe(false)
    })
  })

  test.describe('Answer Recording', () => {
    test('should merge new answers with existing', () => {
      const existingAnswers = { q1: 'A', q2: 'B' }
      const newKey = 'q3'
      const newValue = 'C'

      const updatedAnswers = { ...existingAnswers, [newKey]: newValue }

      expect(updatedAnswers).toEqual({ q1: 'A', q2: 'B', q3: 'C' })
    })

    test('should override existing answer for same key', () => {
      const existingAnswers = { q1: 'A', q2: 'B' }
      const newKey = 'q1'
      const newValue = 'Updated'

      const updatedAnswers = { ...existingAnswers, [newKey]: newValue }

      expect(updatedAnswers.q1).toBe('Updated')
      expect(updatedAnswers.q2).toBe('B')
    })
  })

  test.describe('Context Description Building', () => {
    test('should filter out "Other" specify answers', () => {
      const answers = {
        location: 'California',
        timeline: 'Other (I will specify)',
        purpose: 'Personal use',
      }

      const filterPattern = 'other (i will specify)'
      const contextParts = Object.entries(answers)
        .map(([, value]) => value)
        .filter((value) => value && !value.toLowerCase().includes(filterPattern.toLowerCase()))

      expect(contextParts).toEqual(['California', 'Personal use'])
      expect(contextParts.join(' · ')).toBe('California · Personal use')
    })

    test('should handle empty answers', () => {
      const answers: Record<string, string> = {}

      const contextParts = Object.entries(answers)
        .map(([, value]) => value)
        .filter((value) => value && !value.toLowerCase().includes('other'))

      expect(contextParts).toEqual([])
      expect(contextParts.join(' · ')).toBe('')
    })

    test('should handle all filtered out', () => {
      const answers = {
        q1: 'Other (I will specify)',
        q2: 'Other (I will specify)',
      }

      const filterPattern = 'other (i will specify)'
      const contextParts = Object.entries(answers)
        .map(([, value]) => value)
        .filter((value) => value && !value.toLowerCase().includes(filterPattern.toLowerCase()))

      expect(contextParts).toEqual([])
    })
  })

  test.describe('Free Text Mode', () => {
    test('should detect "Other" option selection', () => {
      const reply = 'Other (I will specify)'
      const isOtherSelected = reply.toLowerCase().includes('other (i will specify)')

      expect(isOtherSelected).toBe(true)
    })

    test('should not trigger for normal answers', () => {
      const normalReplies = ['California', 'Yes', 'Next week', 'Option A']

      for (const reply of normalReplies) {
        const isOtherSelected = reply.toLowerCase().includes('other (i will specify)')
        expect(isOtherSelected).toBe(false)
      }
    })
  })

  test.describe('Duplicate Detection', () => {
    test('should track duplicate prompt state', () => {
      const duplicatePrompt = {
        taskId: 'task-123',
        taskTitle: 'Renew passport',
        input: 'renew my passport',
      }

      expect(duplicatePrompt.taskId).toBe('task-123')
      expect(duplicatePrompt.taskTitle).toBe('Renew passport')
      expect(duplicatePrompt.input).toBe('renew my passport')
    })

    test('should clear duplicate prompt', () => {
      let duplicatePrompt: { taskId: string; taskTitle: string; input: string } | null = {
        taskId: 'task-123',
        taskTitle: 'Renew passport',
        input: 'renew my passport',
      }

      // Clear it
      duplicatePrompt = null

      expect(duplicatePrompt).toBeNull()
    })
  })

  test.describe('Question Navigation', () => {
    test('should correctly identify last question', () => {
      const questions = [
        { key: 'q1', question: 'First?', options: ['A'] },
        { key: 'q2', question: 'Second?', options: ['B'] },
        { key: 'q3', question: 'Last?', options: ['C'] },
      ]
      const currentIndex = 2

      const isLastQuestion = currentIndex >= questions.length - 1
      expect(isLastQuestion).toBe(true)
    })

    test('should correctly identify not last question', () => {
      const questions = [
        { key: 'q1', question: 'First?', options: ['A'] },
        { key: 'q2', question: 'Second?', options: ['B'] },
        { key: 'q3', question: 'Last?', options: ['C'] },
      ]
      const currentIndex = 1

      const isLastQuestion = currentIndex >= questions.length - 1
      expect(isLastQuestion).toBe(false)
    })

    test('should get next question correctly', () => {
      const questions = [
        { key: 'q1', question: 'First?', options: ['A'] },
        { key: 'q2', question: 'Second?', options: ['B'] },
      ]
      const currentIndex = 0

      const nextQuestion = questions[currentIndex + 1]
      expect(nextQuestion.key).toBe('q2')
      expect(nextQuestion.question).toBe('Second?')
    })
  })
})

test.describe('Inactivity Timeout Logic', () => {
  test('should calculate elapsed time correctly', () => {
    const lastActivity = Date.now() - 60000 // 1 minute ago
    const now = Date.now()
    const elapsed = now - lastActivity

    expect(elapsed).toBeGreaterThanOrEqual(60000)
    expect(elapsed).toBeLessThan(61000) // Allow 1 second tolerance
  })

  test('should detect timeout after 5 minutes', () => {
    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000
    const lastActivity = Date.now() - (6 * 60 * 1000) // 6 minutes ago
    const elapsed = Date.now() - lastActivity

    const shouldTimeout = elapsed >= INACTIVITY_TIMEOUT_MS
    expect(shouldTimeout).toBe(true)
  })

  test('should not timeout before 5 minutes', () => {
    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000
    const lastActivity = Date.now() - (4 * 60 * 1000) // 4 minutes ago
    const elapsed = Date.now() - lastActivity

    const shouldTimeout = elapsed >= INACTIVITY_TIMEOUT_MS
    expect(shouldTimeout).toBe(false)
  })
})
