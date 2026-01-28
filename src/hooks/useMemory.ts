'use client'

import { useState, useEffect, useCallback } from 'react'

export interface MemoryEntry {
  id: string
  timestamp: number
  type: 'task_created' | 'task_completed' | 'question_answered' | 'clarification'
  taskTitle?: string
  context?: Record<string, string>
  whatWorked?: string
  userPatterns?: string[]
}

interface MemoryState {
  entries: MemoryEntry[]
  conversationHistory: Array<{ role: string; content: string }>
}

const STORAGE_KEY = 'gather-memory-v1'

export function useMemory() {
  const [memory, setMemory] = useState<MemoryState>({
    entries: [],
    conversationHistory: [],
  })
  const [loaded, setLoaded] = useState(false)

  // Load memory from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setMemory({
          entries: parsed.entries || [],
          conversationHistory: parsed.conversationHistory || [],
        })
      }
    } catch (e) {
      console.warn('Failed to load memory:', e)
    }
    setLoaded(true)
  }, [])

  // Save memory when it changes
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
      } catch (e) {
        console.warn('Failed to save memory:', e)
      }
    }
  }, [memory, loaded])

  const addEntry = useCallback((entry: Omit<MemoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: MemoryEntry = {
      ...entry,
      id: `mem-${Date.now()}`,
      timestamp: Date.now(),
    }
    setMemory((prev) => ({
      ...prev,
      entries: [newEntry, ...prev.entries].slice(0, 100), // Keep last 100 entries
    }))
  }, [])

  const addToConversation = useCallback((role: string, content: string) => {
    setMemory((prev) => ({
      ...prev,
      conversationHistory: [
        ...prev.conversationHistory,
        { role, content },
      ].slice(-20), // Keep last 20 conversation turns
    }))
  }, [])

  const getRelevantMemory = useCallback((taskTitle: string): string => {
    // Find entries related to similar tasks
    const relevant = memory.entries
      .filter((e) => {
        // Match by task title similarity or context
        if (e.taskTitle) {
          const words = taskTitle.toLowerCase().split(' ')
          const titleWords = e.taskTitle.toLowerCase().split(' ')
          return words.some((w) => titleWords.includes(w))
        }
        return false
      })
      .slice(0, 5)

    if (relevant.length === 0) return ''

    // Build memory context string
    return relevant
      .map((e) => {
        if (e.type === 'task_created' && e.context) {
          return `Previously helped with "${e.taskTitle}" - context was: ${Object.entries(e.context)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')}`
        }
        if (e.type === 'task_completed') {
          return `User previously completed "${e.taskTitle}"${e.whatWorked ? ` - what worked: ${e.whatWorked}` : ''}`
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }, [memory.entries])

  const clearMemory = useCallback(() => {
    setMemory({ entries: [], conversationHistory: [] })
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const getMemoryForAI = useCallback((): Array<{ role: string; content: string }> => {
    // Build a condensed memory context for the AI
    const contextLines: string[] = []

    // Add patterns from completed tasks
    const completedTasks = memory.entries.filter((e) => e.type === 'task_completed').slice(0, 3)
    if (completedTasks.length > 0) {
      contextLines.push('Recently completed tasks:')
      completedTasks.forEach((t) => {
        contextLines.push(`- ${t.taskTitle}`)
      })
    }

    // Add user patterns if we have them
    const patterns = new Set<string>()
    memory.entries.forEach((e) => {
      e.userPatterns?.forEach((p) => patterns.add(p))
    })
    if (patterns.size > 0) {
      contextLines.push(`User patterns observed: ${Array.from(patterns).join(', ')}`)
    }

    if (contextLines.length === 0) return []

    return [
      {
        role: 'system',
        content: `Memory context:\n${contextLines.join('\n')}`,
      },
    ]
  }, [memory.entries])

  return {
    memory,
    loaded,
    addEntry,
    addToConversation,
    getRelevantMemory,
    getMemoryForAI,
    clearMemory,
  }
}
