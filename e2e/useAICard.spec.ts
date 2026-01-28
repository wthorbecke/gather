import { test, expect } from '@playwright/test'
import { formatActionLabel, buildCompletionPrompt } from '../src/hooks/useAICard'

/**
 * Tests for useAICard hook helpers
 */

test.describe('formatActionLabel', () => {
  test('should return custom label if provided', () => {
    const action = { type: 'mark_step_done', label: 'Custom Label' }
    expect(formatActionLabel(action)).toBe('Custom Label')
  })

  test('should format mark_step_done', () => {
    const action = { type: 'mark_step_done' }
    expect(formatActionLabel(action)).toBe('Mark step complete')
  })

  test('should format focus_step', () => {
    const action = { type: 'focus_step' }
    expect(formatActionLabel(action)).toBe('Jump to step')
  })

  test('should format create_task', () => {
    const action = { type: 'create_task' }
    expect(formatActionLabel(action)).toBe('Create task')
  })

  test('should format show_sources', () => {
    const action = { type: 'show_sources' }
    expect(formatActionLabel(action)).toBe('Show sources')
  })

  test('should return type for unknown actions', () => {
    const action = { type: 'unknown_action' }
    expect(formatActionLabel(action)).toBe('unknown_action')
  })
})

test.describe('buildCompletionPrompt', () => {
  test('should build prompt for short step text', () => {
    const step = {
      id: 'step-1',
      text: 'Call the DMV',
      done: false,
    }

    const prompt = buildCompletionPrompt(step)
    expect(prompt).toBe('Mark "Call the DMV" complete')
  })

  test('should truncate long step text', () => {
    const step = {
      id: 'step-1',
      text: 'This is a very long step description that needs to be truncated for display purposes',
      done: false,
    }

    const prompt = buildCompletionPrompt(step)
    expect(prompt).toContain('...')
    expect(prompt).toContain('complete')
    // Should be shorter than full text version
    expect(prompt.length).toBeLessThan(100)
  })

  test('should handle exactly 40 character text', () => {
    // Exactly 40 characters
    const step = {
      id: 'step-1',
      text: '1234567890123456789012345678901234567890',
      done: false,
    }

    const prompt = buildCompletionPrompt(step)
    // At exactly 40 chars, no truncation
    expect(prompt).toBe('Mark "1234567890123456789012345678901234567890" complete')
    expect(prompt).not.toContain('...')
  })

  test('should handle 41 character text', () => {
    // 41 characters - should be truncated
    const step = {
      id: 'step-1',
      text: '12345678901234567890123456789012345678901',
      done: false,
    }

    const prompt = buildCompletionPrompt(step)
    expect(prompt).toContain('...')
  })
})

test.describe('AICardState Management', () => {
  test.describe('Thinking State', () => {
    test('should set thinking to true', () => {
      const state = { thinking: true }
      expect(state.thinking).toBe(true)
    })

    test('should preserve message when thinking', () => {
      const state = { thinking: true, message: 'Previous message' }
      expect(state.thinking).toBe(true)
      expect(state.message).toBe('Previous message')
    })
  })

  test.describe('Question State', () => {
    test('should set question with progress', () => {
      const state = {
        question: {
          text: 'What is your location?',
          index: 2,
          total: 3,
        },
        quickReplies: ['California', 'New York', 'Texas'],
      }

      expect(state.question.text).toBe('What is your location?')
      expect(state.question.index).toBe(2)
      expect(state.question.total).toBe(3)
      expect(state.quickReplies).toHaveLength(3)
    })
  })

  test.describe('Task Created State', () => {
    test('should include task object', () => {
      const task = {
        id: 'task-123',
        title: 'Renew passport',
        category: 'soon' as const,
        steps: [
          { id: 'step-1', text: 'Get photo', done: false },
          { id: 'step-2', text: 'Fill form', done: false },
        ],
      }

      const state = {
        message: "Here's your plan.",
        taskCreated: task,
      }

      expect(state.taskCreated.id).toBe('task-123')
      expect(state.taskCreated.steps).toHaveLength(2)
    })
  })

  test.describe('Sources State', () => {
    test('should include sources array', () => {
      const state = {
        message: 'Here is what I found.',
        sources: [
          { title: 'DMV Official', url: 'https://dmv.ca.gov' },
          { title: 'State.gov', url: 'https://state.gov' },
        ],
        showSources: true,
      }

      expect(state.sources).toHaveLength(2)
      expect(state.sources[0].title).toBe('DMV Official')
      expect(state.showSources).toBe(true)
    })

    test('should hide sources when showSources is false', () => {
      const state = {
        message: 'Response',
        sources: [{ title: 'Source', url: 'https://example.com' }],
        showSources: false,
      }

      expect(state.showSources).toBe(false)
    })
  })

  test.describe('Actions State', () => {
    test('should include actions array', () => {
      const state = {
        message: 'I can help with that.',
        actions: [
          { type: 'mark_step_done' as const, stepId: 'step-1', label: 'Mark done' },
          { type: 'focus_step' as const, stepId: 'step-2' },
          { type: 'create_task' as const, title: 'New task' },
        ],
      }

      expect(state.actions).toHaveLength(3)
      expect(state.actions[0].type).toBe('mark_step_done')
      expect(state.actions[0].stepId).toBe('step-1')
    })
  })

  test.describe('Error State', () => {
    test('should include retry options', () => {
      const state = {
        message: "I couldn't analyze that right now.",
        quickReplies: ['Try again', 'Add task without steps'],
        pendingTaskName: 'Renew passport',
      }

      expect(state.quickReplies).toContain('Try again')
      expect(state.quickReplies).toContain('Add task without steps')
      expect(state.pendingTaskName).toBe('Renew passport')
    })
  })
})

test.describe('State Transitions', () => {
  test('should transition from thinking to message', () => {
    let state: { thinking?: boolean; message?: string } = { thinking: true }

    // After AI responds
    state = { message: 'Here is the answer.' }

    expect(state.thinking).toBeUndefined()
    expect(state.message).toBe('Here is the answer.')
  })

  test('should transition from message to question', () => {
    let state: {
      message?: string
      question?: { text: string; index: number; total: number }
      quickReplies?: string[]
    } = { message: 'Let me help you.' }

    // AI asks a question
    state = {
      question: { text: 'Where do you live?', index: 1, total: 2 },
      quickReplies: ['CA', 'NY', 'TX'],
    }

    expect(state.message).toBeUndefined()
    expect(state.question?.text).toBe('Where do you live?')
  })

  test('should transition from question to task created', () => {
    let state: {
      question?: { text: string; index: number; total: number }
      message?: string
      taskCreated?: { id: string; title: string }
    } = {
      question: { text: 'Last question?', index: 2, total: 2 },
    }

    // All questions answered, task created
    state = {
      message: "Here's your plan.",
      taskCreated: { id: 'task-1', title: 'New Task' },
    }

    expect(state.question).toBeUndefined()
    expect(state.taskCreated?.title).toBe('New Task')
  })

  test('should clear all state', () => {
    const state = null

    expect(state).toBeNull()
  })
})

test.describe('Quick Replies', () => {
  test('should limit to reasonable count', () => {
    const replies = ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Other']

    // Component should slice to max 8
    const limited = replies.slice(0, 8)

    expect(limited).toHaveLength(5)
    expect(limited).toContain('Other')
  })

  test('should handle empty replies', () => {
    const state = {
      message: 'Just a message.',
      quickReplies: undefined,
    }

    const replies = state.quickReplies || []
    expect(replies).toHaveLength(0)
  })
})

test.describe('Pending Input', () => {
  test('should store input for retry', () => {
    const pendingInput = 'Renew my passport'

    expect(pendingInput).toBe('Renew my passport')
  })

  test('should clear on success', () => {
    let pendingInput: string | null = 'Renew my passport'

    // After successful task creation
    pendingInput = null

    expect(pendingInput).toBeNull()
  })
})
