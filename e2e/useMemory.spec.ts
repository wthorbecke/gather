import { test, expect } from '@playwright/test'

/**
 * Tests for useMemory hook logic
 *
 * Tests the memory management patterns used in the app
 */

test.describe('Memory Entry Management', () => {
  test.describe('Entry Creation', () => {
    test('should create entry with timestamp and id', () => {
      const entry = {
        type: 'task_created' as const,
        taskTitle: 'Renew passport',
        context: { location: 'California' },
      }

      const newEntry = {
        ...entry,
        id: `mem-${Date.now()}`,
        timestamp: Date.now(),
      }

      expect(newEntry.id).toMatch(/^mem-\d+$/)
      expect(newEntry.timestamp).toBeGreaterThan(0)
      expect(newEntry.type).toBe('task_created')
      expect(newEntry.taskTitle).toBe('Renew passport')
    })

    test('should support different entry types', () => {
      const types = ['task_created', 'task_completed', 'question_answered', 'clarification'] as const

      for (const type of types) {
        const entry = {
          type,
          id: `mem-${Date.now()}`,
          timestamp: Date.now(),
        }

        expect(entry.type).toBe(type)
      }
    })
  })

  test.describe('Entry Limits', () => {
    test('should keep only last 100 entries', () => {
      const entries: Array<{ id: string; timestamp: number }> = []

      // Add 150 entries
      for (let i = 0; i < 150; i++) {
        entries.push({
          id: `mem-${i}`,
          timestamp: Date.now() + i,
        })
      }

      // Simulate the slice operation
      const limitedEntries = entries.slice(0, 100)

      expect(limitedEntries).toHaveLength(100)
      expect(limitedEntries[0].id).toBe('mem-0')
      expect(limitedEntries[99].id).toBe('mem-99')
    })

    test('should prepend new entries', () => {
      const existingEntries = [
        { id: 'mem-1', timestamp: 1000 },
        { id: 'mem-2', timestamp: 2000 },
      ]

      const newEntry = { id: 'mem-3', timestamp: 3000 }
      const updatedEntries = [newEntry, ...existingEntries].slice(0, 100)

      expect(updatedEntries[0].id).toBe('mem-3')
      expect(updatedEntries[1].id).toBe('mem-1')
      expect(updatedEntries[2].id).toBe('mem-2')
    })
  })

  test.describe('Conversation History', () => {
    test('should keep last 20 conversation turns', () => {
      const history: Array<{ role: string; content: string }> = []

      // Add 30 messages
      for (let i = 0; i < 30; i++) {
        history.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        })
      }

      // Simulate the slice operation
      const limitedHistory = history.slice(-20)

      expect(limitedHistory).toHaveLength(20)
      expect(limitedHistory[0].content).toBe('Message 10')
      expect(limitedHistory[19].content).toBe('Message 29')
    })

    test('should add new messages to end', () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ]

      const updated = [
        ...history,
        { role: 'user', content: 'New message' },
      ].slice(-20)

      expect(updated).toHaveLength(3)
      expect(updated[2].content).toBe('New message')
    })
  })
})

test.describe('Memory Relevance', () => {
  test.describe('Task Title Matching', () => {
    test('should find related entries by word overlap', () => {
      const entries = [
        { id: '1', taskTitle: 'Renew my passport', type: 'task_created' as const, timestamp: 1 },
        { id: '2', taskTitle: 'File taxes 2024', type: 'task_completed' as const, timestamp: 2 },
        { id: '3', taskTitle: 'Get Real ID', type: 'task_created' as const, timestamp: 3 },
      ]

      const searchTitle = 'passport application'
      const searchWords = searchTitle.toLowerCase().split(' ')

      const relevant = entries.filter((e) => {
        if (!e.taskTitle) return false
        const titleWords = e.taskTitle.toLowerCase().split(' ')
        return searchWords.some((w) => titleWords.includes(w))
      })

      expect(relevant).toHaveLength(1)
      expect(relevant[0].taskTitle).toBe('Renew my passport')
    })

    test('should return empty for no matches', () => {
      const entries = [
        { id: '1', taskTitle: 'Renew my passport', type: 'task_created' as const, timestamp: 1 },
        { id: '2', taskTitle: 'File taxes', type: 'task_completed' as const, timestamp: 2 },
      ]

      const searchTitle = 'buy groceries'
      const searchWords = searchTitle.toLowerCase().split(' ')

      const relevant = entries.filter((e) => {
        if (!e.taskTitle) return false
        const titleWords = e.taskTitle.toLowerCase().split(' ')
        return searchWords.some((w) => titleWords.includes(w))
      })

      expect(relevant).toHaveLength(0)
    })

    test('should limit relevant entries to 5', () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        taskTitle: `passport task ${i}`,
        type: 'task_created' as const,
        timestamp: i,
      }))

      const searchTitle = 'passport'
      const searchWords = searchTitle.toLowerCase().split(' ')

      const relevant = entries
        .filter((e) => {
          if (!e.taskTitle) return false
          const titleWords = e.taskTitle.toLowerCase().split(' ')
          return searchWords.some((w) => titleWords.includes(w))
        })
        .slice(0, 5)

      expect(relevant).toHaveLength(5)
    })
  })
})

test.describe('Memory Context for AI', () => {
  test.describe('Building Context Lines', () => {
    test('should include completed tasks', () => {
      const entries = [
        { type: 'task_completed' as const, taskTitle: 'Renew passport' },
        { type: 'task_completed' as const, taskTitle: 'File taxes' },
        { type: 'task_created' as const, taskTitle: 'New task' },
      ]

      const completedTasks = entries
        .filter((e) => e.type === 'task_completed')
        .slice(0, 3)

      expect(completedTasks).toHaveLength(2)
      expect(completedTasks[0].taskTitle).toBe('Renew passport')
    })

    test('should extract unique patterns', () => {
      const entries = [
        { userPatterns: ['prefers morning', 'likes detailed steps'] },
        { userPatterns: ['prefers morning', 'needs reminders'] },
        { userPatterns: ['likes detailed steps'] },
      ]

      const patterns = new Set<string>()
      entries.forEach((e) => {
        e.userPatterns?.forEach((p) => patterns.add(p))
      })

      expect(patterns.size).toBe(3)
      expect(Array.from(patterns)).toContain('prefers morning')
      expect(Array.from(patterns)).toContain('likes detailed steps')
      expect(Array.from(patterns)).toContain('needs reminders')
    })

    test('should format context for AI', () => {
      const completedTasks = [
        { taskTitle: 'Task 1' },
        { taskTitle: 'Task 2' },
      ]
      const patterns = ['prefers morning', 'detailed steps']

      const contextLines: string[] = []

      if (completedTasks.length > 0) {
        contextLines.push('Recently completed tasks:')
        completedTasks.forEach((t) => {
          contextLines.push(`- ${t.taskTitle}`)
        })
      }

      if (patterns.length > 0) {
        contextLines.push(`User patterns observed: ${patterns.join(', ')}`)
      }

      const context = contextLines.join('\n')

      expect(context).toContain('Recently completed tasks:')
      expect(context).toContain('- Task 1')
      expect(context).toContain('- Task 2')
      expect(context).toContain('User patterns observed: prefers morning, detailed steps')
    })
  })

  test.describe('Memory Message Format', () => {
    test('should return empty array when no context', () => {
      const contextLines: string[] = []

      const result = contextLines.length === 0
        ? []
        : [{ role: 'system', content: `Memory context:\n${contextLines.join('\n')}` }]

      expect(result).toEqual([])
    })

    test('should return system message when context exists', () => {
      const contextLines = ['Recently completed: Task 1', 'Pattern: morning person']

      const result = contextLines.length === 0
        ? []
        : [{ role: 'system', content: `Memory context:\n${contextLines.join('\n')}` }]

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('system')
      expect(result[0].content).toContain('Memory context:')
      expect(result[0].content).toContain('Recently completed: Task 1')
    })
  })
})

test.describe('LocalStorage Persistence', () => {
  test('should serialize memory state to JSON', () => {
    const memory = {
      entries: [
        { id: 'mem-1', type: 'task_created', taskTitle: 'Test', timestamp: 123 },
      ],
      conversationHistory: [
        { role: 'user', content: 'Hello' },
      ],
    }

    const serialized = JSON.stringify(memory)
    const parsed = JSON.parse(serialized)

    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].taskTitle).toBe('Test')
    expect(parsed.conversationHistory).toHaveLength(1)
  })

  test('should handle empty memory state', () => {
    const memory = {
      entries: [],
      conversationHistory: [],
    }

    const serialized = JSON.stringify(memory)
    const parsed = JSON.parse(serialized)

    expect(parsed.entries).toEqual([])
    expect(parsed.conversationHistory).toEqual([])
  })

  test('should handle malformed stored data', () => {
    const malformed = 'not valid json'

    let memory = { entries: [], conversationHistory: [] }
    try {
      memory = JSON.parse(malformed)
    } catch {
      // Keep default
    }

    expect(memory.entries).toEqual([])
    expect(memory.conversationHistory).toEqual([])
  })

  test('should handle partial stored data', () => {
    const partial = JSON.stringify({ entries: [{ id: '1' }] })
    const parsed = JSON.parse(partial)

    const memory = {
      entries: parsed.entries || [],
      conversationHistory: parsed.conversationHistory || [],
    }

    expect(memory.entries).toHaveLength(1)
    expect(memory.conversationHistory).toEqual([])
  })
})
