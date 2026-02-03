import { test, expect } from '@playwright/test'
import {
  isQuestion,
  isStepRequest,
  normalizeForMatch,
  detectCompletionIntent,
  createFallbackSteps,
} from '../src/lib/taskHelpers'

/**
 * Unit tests for taskHelpers functions
 * These test pure functions directly without browser interaction
 */

test.describe('isQuestion', () => {
  test('returns true for question words', () => {
    expect(isQuestion('how do I renew my passport?')).toBe(true)
    expect(isQuestion('what documents do I need?')).toBe(true)
    expect(isQuestion('when is this due?')).toBe(true)
    expect(isQuestion('where should I go?')).toBe(true)
    expect(isQuestion('why is this required?')).toBe(true)
    expect(isQuestion('can I do this online?')).toBe(true)
    expect(isQuestion('is this the right form?')).toBe(true)
    expect(isQuestion('are these the correct documents?')).toBe(true)
    expect(isQuestion('do I need an appointment?')).toBe(true)
    expect(isQuestion('does this expire?')).toBe(true)
    expect(isQuestion('will this work?')).toBe(true)
    expect(isQuestion('should I call first?')).toBe(true)
  })

  test('returns true for questions ending with ?', () => {
    expect(isQuestion('passport renewal process?')).toBe(true)
    expect(isQuestion('next step?')).toBe(true)
  })

  test('returns false for task statements', () => {
    expect(isQuestion('renew my passport')).toBe(false)
    expect(isQuestion('file taxes')).toBe(false)
    expect(isQuestion('call the DMV')).toBe(false)
    expect(isQuestion('get a real id')).toBe(false)
  })

  test('handles edge cases', () => {
    expect(isQuestion('')).toBe(false)
    expect(isQuestion('   ')).toBe(false)
    // "Can" alone doesn't match "can " with space
    expect(isQuestion('can I help')).toBe(true)
  })
})

test.describe('isStepRequest', () => {
  test('returns true for step-related phrases', () => {
    expect(isStepRequest('add steps')).toBe(true)
    expect(isStepRequest('break down this task')).toBe(true)
    expect(isStepRequest('give me a checklist')).toBe(true)
    expect(isStepRequest('step-by-step guide')).toBe(true)
    expect(isStepRequest('step by step')).toBe(true)
    expect(isStepRequest('what are the steps')).toBe(true)
    expect(isStepRequest('outline this')).toBe(true)
    expect(isStepRequest('plan for this')).toBe(true)
  })

  test('returns false for regular questions/tasks', () => {
    expect(isStepRequest('how do I do this?')).toBe(false)
    expect(isStepRequest('renew my passport')).toBe(false)
    expect(isStepRequest('what documents do I need?')).toBe(false)
  })
})

test.describe('normalizeForMatch', () => {
  test('converts to lowercase', () => {
    expect(normalizeForMatch('Renew Passport')).toBe('renew passport')
    expect(normalizeForMatch('FILE TAXES')).toBe('file taxes')
  })

  test('removes special characters', () => {
    expect(normalizeForMatch("don't forget!")).toBe('don t forget')
    expect(normalizeForMatch('task #1')).toBe('task 1')
    expect(normalizeForMatch('email: test@example.com')).toBe('email test example com')
  })

  test('normalizes whitespace', () => {
    expect(normalizeForMatch('  multiple   spaces  ')).toBe('multiple spaces')
    expect(normalizeForMatch('tab\there')).toBe('tab here')
  })

  test('handles empty strings', () => {
    expect(normalizeForMatch('')).toBe('')
    expect(normalizeForMatch('   ')).toBe('')
  })
})

test.describe('detectCompletionIntent', () => {
  test('returns true for completion phrases', () => {
    expect(detectCompletionIntent('I have the documents')).toBe(true)
    expect(detectCompletionIntent('I got my passport')).toBe(true)
    expect(detectCompletionIntent('I found the form')).toBe(true)
    expect(detectCompletionIntent('I completed the application')).toBe(true)
    expect(detectCompletionIntent('I submitted everything')).toBe(true)
    expect(detectCompletionIntent('I called them yesterday')).toBe(true)
    expect(detectCompletionIntent('I emailed the office')).toBe(true)
    expect(detectCompletionIntent('I booked an appointment')).toBe(true)
    expect(detectCompletionIntent('I paid the fee')).toBe(true)
    expect(detectCompletionIntent('just did it')).toBe(true)
    expect(detectCompletionIntent('done with that step')).toBe(true)
  })

  test('returns false for negations', () => {
    expect(detectCompletionIntent('I have not done this yet')).toBe(false)
    expect(detectCompletionIntent("I haven't called them")).toBe(false)
    expect(detectCompletionIntent('I did not submit')).toBe(false)
    expect(detectCompletionIntent("I didn't finish")).toBe(false)
    expect(detectCompletionIntent('not yet completed')).toBe(false)
    expect(detectCompletionIntent("haven't yet started")).toBe(false)
  })

  test('returns false for non-completion statements', () => {
    expect(detectCompletionIntent('what do I need?')).toBe(false)
    expect(detectCompletionIntent('help me with this')).toBe(false)
    expect(detectCompletionIntent('next step please')).toBe(false)
  })
})

test.describe('createFallbackSteps', () => {
  test('creates 3 steps with actionable content', () => {
    const steps = createFallbackSteps('Generic Task')

    expect(steps).toHaveLength(3)
    expect(steps[0].done).toBe(false)
    expect(steps[0].id).toMatch(/^step-\d+-1$/)
    // Generic fallback should have actionable steps
    expect(steps[0].text).toContain('Search for how to')
    expect(steps[2].text).toContain('Do the first thing')
  })

  test('uses keyword matching for common task types', () => {
    // "Cancel" keyword
    const cancelSteps = createFallbackSteps('Cancel gym membership')
    expect(cancelSteps[0].text).toContain('cancellation')

    // "Pay" keyword
    const paySteps = createFallbackSteps('Pay electric bill')
    expect(paySteps[0].text).toContain('bill or invoice')

    // "Clean" keyword
    const cleanSteps = createFallbackSteps('Clean my room')
    expect(cleanSteps[0].text).toContain('timer')

    // "Call" keyword
    const callSteps = createFallbackSteps('Call the dentist')
    expect(callSteps[0].text).toContain('Write down what you need to say')
  })

  test('all steps have unique IDs', () => {
    const steps = createFallbackSteps('Test Task')
    const ids = steps.map(s => s.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(steps.length)
  })

  test('all steps are incomplete', () => {
    const steps = createFallbackSteps('Test Task')

    expect(steps.every(s => s.done === false)).toBe(true)
  })

  test('steps include time estimates', () => {
    const steps = createFallbackSteps('Write a report')
    expect(steps[0].time).toBeDefined()
    expect(steps[0].time).toMatch(/\d+ min/)
  })
})

test.describe('findDuplicateTask', () => {
  // Import the function for this test
  const { findDuplicateTask } = require('../src/lib/taskHelpers')

  const mockTasks = [
    { id: '1', title: 'Renew my passport' },
    { id: '2', title: 'File 2024 taxes' },
    { id: '3', title: 'Get a Real ID' },
    { id: '4', title: 'Cancel gym membership' },
  ]

  test('finds exact match', () => {
    const result = findDuplicateTask('Renew my passport', mockTasks)
    expect(result?.id).toBe('1')
  })

  test('finds case-insensitive match', () => {
    const result = findDuplicateTask('RENEW MY PASSPORT', mockTasks)
    expect(result?.id).toBe('1')
  })

  test('finds substring match', () => {
    const result = findDuplicateTask('I need to renew my passport soon', mockTasks)
    expect(result?.id).toBe('1')
  })

  test('finds token overlap match', () => {
    // "renew passport" shares "renew" and "passport" with "Renew my passport"
    const result = findDuplicateTask('renew passport please', mockTasks)
    expect(result?.id).toBe('1')
  })

  test('returns null for no match', () => {
    const result = findDuplicateTask('Buy groceries', mockTasks)
    expect(result).toBeNull()
  })

  test('returns null for empty input', () => {
    const result = findDuplicateTask('', mockTasks)
    expect(result).toBeNull()
  })

  test('returns null for empty task list', () => {
    const result = findDuplicateTask('Some task', [])
    expect(result).toBeNull()
  })
})

test.describe('filterActions', () => {
  const { filterActions } = require('../src/lib/taskHelpers')

  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    steps: [
      { id: 'step-1', text: 'First step', done: false },
      { id: 'step-2', text: 'Second step', done: false },
    ],
  }

  test('filters allowed action types', () => {
    const actions = [
      { type: 'mark_step_done', stepId: 'step-1' },
      { type: 'invalid_action' },
      { type: 'focus_step', stepId: 'step-2' },
      { type: 'create_task', title: 'New Task' },
      { type: 'show_sources' },
    ]

    const filtered = filterActions(actions, mockTask)

    expect(filtered).toHaveLength(4)
    expect(filtered.map((a: { type: string }) => a.type)).toEqual([
      'mark_step_done',
      'focus_step',
      'create_task',
      'show_sources',
    ])
  })

  test('filters out step actions with invalid stepId', () => {
    const actions = [
      { type: 'mark_step_done', stepId: 'invalid-step' },
      { type: 'focus_step', stepId: 'step-1' },
    ]

    const filtered = filterActions(actions, mockTask)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].stepId).toBe('step-1')
  })

  test('filters out create_task with empty title', () => {
    const actions = [
      { type: 'create_task', title: '' },
      { type: 'create_task', title: '  ' },
      { type: 'create_task', title: 'Valid Task' },
    ]

    const filtered = filterActions(actions, null)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe('Valid Task')
  })

  test('handles null/undefined actions', () => {
    const actions = [null, undefined, { type: 'show_sources' }]

    const filtered = filterActions(actions, null)

    expect(filtered).toHaveLength(1)
  })
})

test.describe('sanitizeQuestions', () => {
  const { sanitizeQuestions } = require('../src/lib/taskHelpers')

  test('fixes tax year options to current years', () => {
    const questions = [
      { key: 'tax_year', question: 'Which tax year?', options: ['2020', '2019'] },
    ]

    const sanitized = sanitizeQuestions('File taxes', questions)

    expect(sanitized[0].options).toContain('2025')
    expect(sanitized[0].options).toContain('2024')
  })

  test('simplifies Real ID questions', () => {
    const questions = [
      {
        key: 'has_real_id',
        question: 'Do you currently have a Real ID?',
        options: ['Yes', 'No', 'Not sure'],
      },
    ]

    const sanitized = sanitizeQuestions('Get a Real ID', questions)

    expect(sanitized[0].question).toBe("Do you already have a star on your driver's license?")
    expect(sanitized[0].options).toHaveLength(2)
  })

  test('preserves other questions unchanged', () => {
    const questions = [
      { key: 'location', question: 'What state?', options: ['CA', 'NY', 'TX'] },
    ]

    const sanitized = sanitizeQuestions('Generic task', questions)

    expect(sanitized[0]).toEqual(questions[0])
  })
})

test.describe('findMatchingStep', () => {
  const { findMatchingStep } = require('../src/lib/taskHelpers')

  const mockSteps = [
    { id: '1', text: 'Get your passport photo taken', done: false, summary: 'Visit a local photo shop' },
    { id: '2', text: 'Fill out form DS-11', done: false, summary: 'Download from state.gov' },
    { id: '3', text: 'Schedule appointment', done: true, summary: 'Book online at USPS' },
    { id: '4', text: 'Pay the application fee', done: false, summary: '$130 total' },
  ]

  test('finds step by keyword trigger', () => {
    const match = findMatchingStep('I got my passport photo', mockSteps)
    expect(match?.id).toBe('1')
  })

  test('finds step by payment keywords', () => {
    const match = findMatchingStep('I paid the fee', mockSteps)
    expect(match?.id).toBe('4')
  })

  test('skips already completed steps', () => {
    const match = findMatchingStep('I booked an appointment', mockSteps)
    // Step 3 is done, so it should not match
    expect(match).toBeUndefined()
  })

  test('returns undefined when no match', () => {
    const match = findMatchingStep('I went to the store', mockSteps)
    expect(match).toBeUndefined()
  })
})

test.describe('createStepFromAIResponse', () => {
  const { createStepFromAIResponse } = require('../src/lib/taskHelpers')

  test('creates step from string', () => {
    const step = createStepFromAIResponse('Simple step text', 0)

    expect(step.text).toBe('Simple step text')
    expect(step.done).toBe(false)
    expect(step.id).toMatch(/^step-\d+-0$/)
  })

  test('creates step from object with all fields', () => {
    const input = {
      text: 'Step with details',
      summary: 'Brief summary',
      detail: 'Extended detail',
      time: '10 min',
      source: { name: 'Official Site', url: 'https://example.com' },
      action: { text: 'Click here', url: 'https://example.com/action' },
    }

    const step = createStepFromAIResponse(input, 1)

    expect(step.text).toBe('Step with details')
    expect(step.summary).toBe('Brief summary')
    expect(step.detail).toBe('Extended detail')
    expect(step.time).toBe('10 min')
    expect(step.source).toEqual(input.source)
    expect(step.action).toEqual(input.action)
    expect(step.done).toBe(false)
  })

  test('handles missing optional fields', () => {
    const step = createStepFromAIResponse({ text: 'Just text' }, 2)

    expect(step.text).toBe('Just text')
    expect(step.summary).toBeUndefined()
    expect(step.detail).toBeUndefined()
  })
})
