'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CoachingMemory,
  DEFAULT_COACHING_MEMORY,
  ProductivityPattern,
  CopingStrategy,
  StrugglesAndVictories,
  ConversationSummary,
  detectProductivityPatterns,
  buildCoachingContext,
  analyzeConversationForMemory,
  getProactiveCheckInContext,
  pruneCoachingMemory,
  COACHING_MEMORY_KEY,
} from '@/lib/coachingMemory'
import type { Task, Step } from '@/hooks/useUserData'

interface UseCoachingMemoryOptions {
  userId?: string | null
  enabled?: boolean
}

export function useCoachingMemory(options: UseCoachingMemoryOptions = {}) {
  const { userId, enabled = true } = options
  const [memory, setMemory] = useState<CoachingMemory>(DEFAULT_COACHING_MEMORY)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  // Prevent duplicate saves
  const pendingSave = useRef<NodeJS.Timeout | null>(null)

  // Load memory on mount
  useEffect(() => {
    if (!enabled) {
      setLoaded(true)
      return
    }

    const loadMemory = async () => {
      if (userId) {
        // Load from Supabase for authenticated users
        try {
          const { data, error } = await supabase
            .from('user_memory')
            .select('content')
            .eq('user_id', userId)
            .eq('entry_type', 'coaching_memory')
            .single()

          if (!error && data?.content) {
            setMemory({ ...DEFAULT_COACHING_MEMORY, ...(data.content as CoachingMemory) })
          }
        } catch (e) {
          console.warn('Failed to load coaching memory from Supabase:', e)
          loadFromLocalStorage()
        }
      } else {
        // Demo mode - load from localStorage
        loadFromLocalStorage()
      }
      setLoaded(true)
    }

    const loadFromLocalStorage = () => {
      try {
        const stored = localStorage.getItem(COACHING_MEMORY_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setMemory({ ...DEFAULT_COACHING_MEMORY, ...parsed })
        }
      } catch (e) {
        console.warn('Failed to load coaching memory from localStorage:', e)
      }
    }

    loadMemory()
  }, [userId, enabled])

  // Save memory with debouncing
  const saveMemory = useCallback(async (newMemory: CoachingMemory) => {
    if (!enabled) return

    // Prune before saving
    const prunedMemory = pruneCoachingMemory(newMemory)

    if (pendingSave.current) {
      clearTimeout(pendingSave.current)
    }

    pendingSave.current = setTimeout(async () => {
      setSaving(true)

      if (userId) {
        // Save to Supabase
        try {
          const { data: existing } = await supabase
            .from('user_memory')
            .select('id')
            .eq('user_id', userId)
            .eq('entry_type', 'coaching_memory')
            .single()

          if (existing) {
            await supabase
              .from('user_memory')
              .update({ content: prunedMemory })
              .eq('id', existing.id)
          } else {
            await supabase
              .from('user_memory')
              .insert({
                user_id: userId,
                entry_type: 'coaching_memory',
                content: prunedMemory,
              })
          }
        } catch (e) {
          console.warn('Failed to save coaching memory to Supabase:', e)
        }
      } else {
        // Save to localStorage
        try {
          localStorage.setItem(COACHING_MEMORY_KEY, JSON.stringify(prunedMemory))
        } catch (e) {
          console.warn('Failed to save coaching memory to localStorage:', e)
        }
      }

      setSaving(false)
    }, 1000)
  }, [userId, enabled])

  // Add a productivity pattern
  const addPattern = useCallback((pattern: Omit<ProductivityPattern, 'lastObserved'>) => {
    setMemory(prev => {
      const existing = prev.productivityPatterns.find(p => p.type === pattern.type)
      const updated = existing
        ? prev.productivityPatterns.map(p =>
            p.type === pattern.type
              ? { ...p, ...pattern, lastObserved: new Date().toISOString() }
              : p
          )
        : [...prev.productivityPatterns, { ...pattern, lastObserved: new Date().toISOString() }]

      const newMemory = { ...prev, productivityPatterns: updated }
      saveMemory(newMemory)
      return newMemory
    })
  }, [saveMemory])

  // Add or update a coping strategy
  const addCopingStrategy = useCallback((strategy: Omit<CopingStrategy, 'id' | 'lastUsed'>) => {
    setMemory(prev => {
      const existing = prev.copingStrategies.find(s =>
        s.trigger.toLowerCase() === strategy.trigger.toLowerCase()
      )

      if (existing) {
        const updated = prev.copingStrategies.map(s =>
          s.id === existing.id
            ? {
                ...s,
                effectivenessScore: (s.effectivenessScore + strategy.effectivenessScore) / 2,
                usageCount: s.usageCount + 1,
                lastUsed: new Date().toISOString(),
              }
            : s
        )
        const newMemory = { ...prev, copingStrategies: updated }
        saveMemory(newMemory)
        return newMemory
      } else {
        const newStrategy: CopingStrategy = {
          ...strategy,
          id: `strategy-${Date.now()}`,
          lastUsed: new Date().toISOString(),
        }
        const newMemory = {
          ...prev,
          copingStrategies: [newStrategy, ...prev.copingStrategies],
        }
        saveMemory(newMemory)
        return newMemory
      }
    })
  }, [saveMemory])

  // Record a struggle or victory
  const recordStruggleOrVictory = useCallback((
    type: 'struggle' | 'victory',
    description: string,
    details?: { taskType?: string; resolution?: string; impact?: string }
  ) => {
    setMemory(prev => {
      const entry: StrugglesAndVictories = {
        id: `sv-${Date.now()}`,
        type,
        description,
        timestamp: new Date().toISOString(),
        ...details,
      }
      const newMemory = {
        ...prev,
        strugglesAndVictories: [entry, ...prev.strugglesAndVictories],
      }
      saveMemory(newMemory)
      return newMemory
    })
  }, [saveMemory])

  // Add a conversation summary
  const addConversationSummary = useCallback((summary: Omit<ConversationSummary, 'id' | 'date'>) => {
    setMemory(prev => {
      const entry: ConversationSummary = {
        ...summary,
        id: `conv-${Date.now()}`,
        date: new Date().toISOString(),
      }
      const newMemory = {
        ...prev,
        conversationSummaries: [entry, ...prev.conversationSummaries],
        stats: {
          ...prev.stats,
          totalConversationsAnalyzed: prev.stats.totalConversationsAnalyzed + 1,
          lastAnalysis: new Date().toISOString(),
        },
      }
      saveMemory(newMemory)
      return newMemory
    })
  }, [saveMemory])

  // Analyze completions and update patterns
  const analyzeCompletions = useCallback((completions: Array<{
    taskId: string
    taskTitle: string
    completedAt: Date
    stepCount: number
    taskType?: string
    energy?: 'low' | 'medium' | 'high'
  }>) => {
    if (completions.length === 0) return

    const completionData = completions.map(c => ({
      ...c,
      dayOfWeek: c.completedAt.getDay(),
      hourOfDay: c.completedAt.getHours(),
    }))

    setMemory(prev => {
      const newPatterns = detectProductivityPatterns(completionData, prev.productivityPatterns)
      const newMemory = {
        ...prev,
        productivityPatterns: newPatterns,
        stats: {
          ...prev.stats,
          totalTasksAnalyzed: prev.stats.totalTasksAnalyzed + completions.length,
          lastAnalysis: new Date().toISOString(),
        },
      }
      saveMemory(newMemory)
      return newMemory
    })
  }, [saveMemory])

  // Analyze a conversation and extract insights
  const analyzeConversation = useCallback((
    messages: Array<{ role: string; content: string }>,
    taskContext?: { title: string; steps?: Step[] }
  ) => {
    const analysis = analyzeConversationForMemory(messages, taskContext)

    // Record struggles or victories if detected
    if (analysis.potentialStruggle) {
      recordStruggleOrVictory('struggle', analysis.potentialStruggle, {
        taskType: taskContext?.title,
      })
    }
    if (analysis.potentialVictory) {
      recordStruggleOrVictory('victory', analysis.potentialVictory, {
        taskType: taskContext?.title,
      })
    }

    // Determine emotional state
    let emotionalState: ConversationSummary['emotionalState'] = 'neutral'
    if (analysis.emotionalIndicators.includes('stuck')) {
      emotionalState = 'stuck'
    } else if (analysis.emotionalIndicators.includes('accomplished')) {
      emotionalState = 'energized'
    } else if (analysis.emotionalIndicators.includes('motivated')) {
      emotionalState = 'motivated'
    }

    // Add conversation summary
    if (messages.length >= 2) {
      addConversationSummary({
        topics: analysis.topics,
        keyInsights: analysis.emotionalIndicators,
        actionsTaken: [],
        emotionalState,
      })
    }
  }, [recordStruggleOrVictory, addConversationSummary])

  // Get coaching context for AI prompts
  const getCoachingContext = useCallback((currentSituation?: {
    taskTitle?: string
    isStuck?: boolean
    timeOfDay?: number
    energy?: 'low' | 'medium' | 'high'
    dayOfWeek?: number
  }) => {
    if (!memory.preferences.memoryEnabled) {
      return ''
    }
    return buildCoachingContext(memory, currentSituation)
  }, [memory])

  // Get proactive check-in info
  const getProactiveCheckIn = useCallback((tasks: Task[]) => {
    return getProactiveCheckInContext(memory, tasks)
  }, [memory])

  // Update preferences
  const updatePreferences = useCallback((
    updates: Partial<CoachingMemory['preferences']>
  ) => {
    setMemory(prev => {
      const newMemory = {
        ...prev,
        preferences: { ...prev.preferences, ...updates },
      }
      saveMemory(newMemory)
      return newMemory
    })
  }, [saveMemory])

  // Clear all memory
  const clearMemory = useCallback(async () => {
    setMemory(DEFAULT_COACHING_MEMORY)

    if (userId) {
      try {
        await supabase
          .from('user_memory')
          .delete()
          .eq('user_id', userId)
          .eq('entry_type', 'coaching_memory')
      } catch (e) {
        console.warn('Failed to clear coaching memory from Supabase:', e)
      }
    } else {
      localStorage.removeItem(COACHING_MEMORY_KEY)
    }
  }, [userId])

  return {
    memory,
    loaded,
    saving,
    // Pattern management
    addPattern,
    analyzeCompletions,
    // Coping strategies
    addCopingStrategy,
    // Struggles and victories
    recordStruggleOrVictory,
    // Conversation analysis
    analyzeConversation,
    addConversationSummary,
    // Context building
    getCoachingContext,
    getProactiveCheckIn,
    // Preferences
    updatePreferences,
    // Clear
    clearMemory,
  }
}
