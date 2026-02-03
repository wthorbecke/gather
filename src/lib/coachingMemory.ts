/**
 * Coaching Memory - Long-term pattern recognition and personalized support
 *
 * This module handles:
 * - Pattern recognition across task completions
 * - Conversation summarization for coaching context
 * - Strategy effectiveness tracking
 * - Proactive check-in context
 */

import type { Task, Step } from '@/hooks/useUserData'

// ============================================================================
// TYPES
// ============================================================================

export interface ProductivityPattern {
  type: 'time_of_day' | 'day_of_week' | 'task_type' | 'energy_correlation' | 'streak_behavior'
  pattern: string
  confidence: number // 0-1
  observedCount: number
  lastObserved: string
}

export interface CopingStrategy {
  id: string
  trigger: string // What situation triggers this strategy
  strategy: string // What worked
  effectivenessScore: number // 0-1 based on subsequent outcomes
  usageCount: number
  lastUsed: string
  context?: string // Additional context about when it works
}

export interface StrugglesAndVictories {
  id: string
  type: 'struggle' | 'victory'
  taskType?: string
  description: string
  resolution?: string // How it was resolved (for struggles)
  impact?: string // What it enabled (for victories)
  timestamp: string
  relatedPatterns?: string[]
}

export interface ConversationSummary {
  id: string
  date: string
  topics: string[]
  keyInsights: string[]
  actionsTaken: string[]
  emotionalState?: 'overwhelmed' | 'motivated' | 'stuck' | 'neutral' | 'energized'
  followUpNeeded?: string
}

export interface CoachingMemory {
  productivityPatterns: ProductivityPattern[]
  copingStrategies: CopingStrategy[]
  strugglesAndVictories: StrugglesAndVictories[]
  conversationSummaries: ConversationSummary[]
  preferences: {
    checkInFrequency: 'daily' | 'weekly' | 'when_stuck' | 'never'
    memoryEnabled: boolean
    shareEmotionalContext: boolean
  }
  stats: {
    totalTasksAnalyzed: number
    totalConversationsAnalyzed: number
    lastAnalysis: string
  }
}

export const DEFAULT_COACHING_MEMORY: CoachingMemory = {
  productivityPatterns: [],
  copingStrategies: [],
  strugglesAndVictories: [],
  conversationSummaries: [],
  preferences: {
    checkInFrequency: 'when_stuck',
    memoryEnabled: true,
    shareEmotionalContext: true,
  },
  stats: {
    totalTasksAnalyzed: 0,
    totalConversationsAnalyzed: 0,
    lastAnalysis: new Date().toISOString(),
  },
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

interface CompletionData {
  taskId: string
  taskTitle: string
  completedAt: Date
  stepCount: number
  taskType?: string
  energy?: 'low' | 'medium' | 'high'
  dayOfWeek: number
  hourOfDay: number
}

/**
 * Analyze task completions to detect productivity patterns
 */
export function detectProductivityPatterns(
  completions: CompletionData[],
  existingPatterns: ProductivityPattern[] = []
): ProductivityPattern[] {
  if (completions.length < 5) {
    // Not enough data to detect patterns
    return existingPatterns
  }

  const patterns: ProductivityPattern[] = []
  const now = new Date().toISOString()

  // Time of day analysis
  const hourCounts = new Map<number, number>()
  completions.forEach(c => {
    const count = hourCounts.get(c.hourOfDay) || 0
    hourCounts.set(c.hourOfDay, count + 1)
  })

  const totalCompletions = completions.length
  const topHours = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  if (topHours.length > 0 && topHours[0][1] >= totalCompletions * 0.3) {
    const hour = topHours[0][0]
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
    patterns.push({
      type: 'time_of_day',
      pattern: `You complete most tasks in the ${period} (around ${hour}:00)`,
      confidence: topHours[0][1] / totalCompletions,
      observedCount: topHours[0][1],
      lastObserved: now,
    })
  }

  // Day of week analysis
  const dayCounts = new Map<number, number>()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  completions.forEach(c => {
    const count = dayCounts.get(c.dayOfWeek) || 0
    dayCounts.set(c.dayOfWeek, count + 1)
  })

  const topDays = Array.from(dayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)

  if (topDays.length > 0 && topDays[0][1] >= totalCompletions * 0.25) {
    patterns.push({
      type: 'day_of_week',
      pattern: `${dayNames[topDays[0][0]]}s are your most productive days`,
      confidence: topDays[0][1] / totalCompletions,
      observedCount: topDays[0][1],
      lastObserved: now,
    })
  }

  // Energy correlation
  const energyCompletions = completions.filter(c => c.energy)
  if (energyCompletions.length >= 5) {
    const energyCounts = { low: 0, medium: 0, high: 0 }
    energyCompletions.forEach(c => {
      if (c.energy) energyCounts[c.energy]++
    })

    const topEnergy = Object.entries(energyCounts)
      .sort((a, b) => b[1] - a[1])[0]

    if (topEnergy[1] >= energyCompletions.length * 0.4) {
      patterns.push({
        type: 'energy_correlation',
        pattern: `You often complete tasks when energy is ${topEnergy[0]}`,
        confidence: topEnergy[1] / energyCompletions.length,
        observedCount: topEnergy[1],
        lastObserved: now,
      })
    }
  }

  // Merge with existing patterns
  const mergedPatterns = [...existingPatterns]
  patterns.forEach(newPattern => {
    const existing = mergedPatterns.find(p => p.type === newPattern.type)
    if (existing) {
      // Update existing pattern
      existing.pattern = newPattern.pattern
      existing.confidence = (existing.confidence + newPattern.confidence) / 2
      existing.observedCount += newPattern.observedCount
      existing.lastObserved = now
    } else {
      mergedPatterns.push(newPattern)
    }
  })

  return mergedPatterns.slice(0, 10) // Keep top 10 patterns
}

// ============================================================================
// COACHING CONTEXT BUILDING
// ============================================================================

/**
 * Build coaching context to inject into AI prompts
 */
export function buildCoachingContext(
  memory: CoachingMemory,
  currentSituation?: {
    taskTitle?: string
    isStuck?: boolean
    timeOfDay?: number
    energy?: 'low' | 'medium' | 'high'
    dayOfWeek?: number
  }
): string {
  if (!memory.preferences.memoryEnabled) {
    return ''
  }

  const contextParts: string[] = []

  // Add relevant productivity patterns
  const relevantPatterns = memory.productivityPatterns
    .filter(p => p.confidence >= 0.5)
    .slice(0, 3)

  if (relevantPatterns.length > 0) {
    contextParts.push('What we know about this user:')
    relevantPatterns.forEach(p => {
      contextParts.push(`- ${p.pattern}`)
    })
  }

  // Add coping strategies if user is stuck
  if (currentSituation?.isStuck) {
    const relevantStrategies = memory.copingStrategies
      .filter(s => s.effectivenessScore >= 0.6)
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
      .slice(0, 2)

    if (relevantStrategies.length > 0) {
      contextParts.push('\nStrategies that have worked before:')
      relevantStrategies.forEach(s => {
        contextParts.push(`- When ${s.trigger}: ${s.strategy}`)
      })
    }
  }

  // Add recent victories for encouragement
  const recentVictories = memory.strugglesAndVictories
    .filter(sv => sv.type === 'victory')
    .slice(0, 2)

  if (recentVictories.length > 0) {
    contextParts.push('\nRecent wins to build on:')
    recentVictories.forEach(v => {
      contextParts.push(`- ${v.description}`)
    })
  }

  // Add emotional context if enabled
  if (memory.preferences.shareEmotionalContext) {
    const recentSummary = memory.conversationSummaries[0]
    if (recentSummary?.emotionalState && recentSummary.emotionalState !== 'neutral') {
      const stateMessages: Record<string, string> = {
        overwhelmed: 'User recently seemed overwhelmed. Keep suggestions small and manageable.',
        stuck: 'User has been feeling stuck. Focus on momentum-building steps.',
        motivated: 'User is feeling motivated. This is a good time for bigger tasks.',
        energized: 'User is energized. Help them channel this productively.',
      }
      const msg = stateMessages[recentSummary.emotionalState]
      if (msg) {
        contextParts.push(`\nNote: ${msg}`)
      }
    }
  }

  // Add time-based context
  if (currentSituation?.timeOfDay !== undefined) {
    const timePattern = memory.productivityPatterns.find(p => p.type === 'time_of_day')
    if (timePattern && timePattern.confidence >= 0.6) {
      const hour = currentSituation.timeOfDay
      const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
      if (timePattern.pattern.includes(period)) {
        contextParts.push(`\nThis is typically their productive time.`)
      }
    }
  }

  return contextParts.join('\n')
}

// ============================================================================
// CONVERSATION ANALYSIS
// ============================================================================

/**
 * Extract insights from a conversation for long-term memory
 */
export function analyzeConversationForMemory(
  messages: Array<{ role: string; content: string }>,
  taskContext?: { title: string; steps?: Step[] }
): {
  topics: string[]
  emotionalIndicators: string[]
  potentialStruggle?: string
  potentialVictory?: string
  copingStrategyUsed?: string
} {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase())

  const topics: string[] = []
  const emotionalIndicators: string[] = []
  let potentialStruggle: string | undefined
  let potentialVictory: string | undefined
  let copingStrategyUsed: string | undefined

  // Detect emotional indicators
  const stuckPhrases = ['stuck', 'can\'t', 'don\'t know', 'overwhelmed', 'too much', 'hard', 'difficult']
  const victoryPhrases = ['did it', 'done', 'finished', 'completed', 'finally', 'managed to', 'figured out']
  const motivatedPhrases = ['ready', 'let\'s go', 'excited', 'motivated', 'want to']

  userMessages.forEach(msg => {
    if (stuckPhrases.some(p => msg.includes(p))) {
      emotionalIndicators.push('stuck')
      if (taskContext?.title) {
        potentialStruggle = `Had difficulty with: ${taskContext.title}`
      }
    }
    if (victoryPhrases.some(p => msg.includes(p))) {
      emotionalIndicators.push('accomplished')
      if (taskContext?.title) {
        potentialVictory = `Completed: ${taskContext.title}`
      }
    }
    if (motivatedPhrases.some(p => msg.includes(p))) {
      emotionalIndicators.push('motivated')
    }
  })

  // Detect topics from task context
  if (taskContext?.title) {
    topics.push(taskContext.title)
  }

  // Detect if a strategy was mentioned
  const strategyPhrases = ['tried', 'what worked', 'helped', 'broke it down', 'started small']
  const assistantMessages = messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content.toLowerCase())

  assistantMessages.forEach(msg => {
    strategyPhrases.forEach(phrase => {
      if (msg.includes(phrase)) {
        copingStrategyUsed = msg.slice(0, 100) // Capture the strategy context
      }
    })
  })

  return {
    topics,
    emotionalIndicators,
    potentialStruggle,
    potentialVictory,
    copingStrategyUsed,
  }
}

// ============================================================================
// PROACTIVE CHECK-IN CONTEXT
// ============================================================================

/**
 * Determine if a proactive check-in is warranted and what to say
 */
export function getProactiveCheckInContext(
  memory: CoachingMemory,
  tasks: Task[],
  now: Date = new Date()
): {
  shouldCheckIn: boolean
  reason?: string
  message?: string
  referencePattern?: string
} {
  if (memory.preferences.checkInFrequency === 'never') {
    return { shouldCheckIn: false }
  }

  // Check for stuck tasks (no progress in 3+ days)
  const stuckTasks = tasks.filter(t => {
    if (!t.steps || t.steps.length === 0) return false
    const allDone = t.steps.every(s => s.done)
    if (allDone) return false // Task is complete

    // Check last interaction (simplified - would need actual timestamp tracking)
    // Use due_date as a proxy for age, or default to checking if there are incomplete steps
    const taskDate = t.due_date ? new Date(t.due_date) : now
    const daysSinceDate = Math.abs((now.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysSinceDate > 3 && t.steps.some(s => !s.done)
  })

  if (stuckTasks.length > 0 && (
    memory.preferences.checkInFrequency === 'when_stuck' ||
    memory.preferences.checkInFrequency === 'daily'
  )) {
    const stuckTask = stuckTasks[0]
    const relevantStrategy = memory.copingStrategies
      .filter(s => s.effectivenessScore >= 0.6)
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore)[0]

    let message = `I noticed "${stuckTask.title}" has been sitting for a few days.`
    if (relevantStrategy) {
      message += ` Last time you were stuck, ${relevantStrategy.strategy.toLowerCase()} helped. Want to try that?`
    } else {
      message += ` What's one tiny thing we could do to move it forward?`
    }

    return {
      shouldCheckIn: true,
      reason: 'stuck_task',
      message,
      referencePattern: relevantStrategy?.strategy,
    }
  }

  // Check for patterns that suggest a good time to work
  const hourNow = now.getHours()
  const dayNow = now.getDay()

  const timePattern = memory.productivityPatterns.find(p =>
    p.type === 'time_of_day' && p.confidence >= 0.6
  )
  const dayPattern = memory.productivityPatterns.find(p =>
    p.type === 'day_of_week' && p.confidence >= 0.6
  )

  if (timePattern || dayPattern) {
    // Check if now matches a productive pattern
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const isProductiveTime = timePattern?.pattern.includes(hourNow < 12 ? 'morning' : hourNow < 17 ? 'afternoon' : 'evening')
    const isProductiveDay = dayPattern?.pattern.includes(dayNames[dayNow])

    if (isProductiveTime && isProductiveDay) {
      return {
        shouldCheckIn: true,
        reason: 'productive_window',
        message: `This is usually a good time for you. Have 10 minutes for a quick task?`,
        referencePattern: timePattern?.pattern || dayPattern?.pattern,
      }
    }
  }

  return { shouldCheckIn: false }
}

// ============================================================================
// MEMORY PERSISTENCE HELPERS
// ============================================================================

export const COACHING_MEMORY_KEY = 'gather-coaching-memory-v1'
export const MAX_PATTERNS = 15
export const MAX_STRATEGIES = 20
export const MAX_STRUGGLES_VICTORIES = 50
export const MAX_SUMMARIES = 30

/**
 * Prune memory to stay within limits
 */
export function pruneCoachingMemory(memory: CoachingMemory): CoachingMemory {
  return {
    ...memory,
    productivityPatterns: memory.productivityPatterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_PATTERNS),
    copingStrategies: memory.copingStrategies
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
      .slice(0, MAX_STRATEGIES),
    strugglesAndVictories: memory.strugglesAndVictories
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_STRUGGLES_VICTORIES),
    conversationSummaries: memory.conversationSummaries
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, MAX_SUMMARIES),
  }
}
