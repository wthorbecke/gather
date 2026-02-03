/**
 * Energy Level Suggestion Utility
 *
 * Suggests appropriate energy levels based on task content keywords.
 * This helps users quickly set energy levels without manual selection.
 */

import { EnergyLevel } from './constants'

// Keywords that suggest high energy/focus required
const HIGH_ENERGY_KEYWORDS = [
  // Cognitive tasks
  'focus', 'concentrate', 'analyze', 'research', 'study', 'learn',
  'write', 'draft', 'create', 'design', 'develop', 'build', 'code',
  'think', 'plan', 'strategy', 'decision', 'complex', 'difficult',
  // Work tasks
  'presentation', 'report', 'proposal', 'meeting', 'interview',
  'negotiate', 'pitch', 'deadline', 'important', 'critical', 'urgent',
  // Financial
  'taxes', 'budget', 'financial', 'investment', 'contract',
]

// Keywords that suggest medium energy/moderate focus
const MEDIUM_ENERGY_KEYWORDS = [
  // Organizing
  'organize', 'sort', 'file', 'arrange', 'schedule', 'plan',
  'review', 'check', 'update', 'edit', 'revise',
  // Communication
  'email', 'message', 'reply', 'respond', 'contact', 'call',
  // Errands
  'appointment', 'doctor', 'dentist', 'grocery', 'shopping',
  // Health
  'exercise', 'workout', 'gym', 'run', 'walk', 'healthy',
]

// Keywords that suggest low energy (can do when tired)
const LOW_ENERGY_KEYWORDS = [
  // Simple tasks
  'simple', 'easy', 'quick', 'routine', 'basic', 'straightforward',
  // Passive activities
  'watch', 'read', 'listen', 'rest', 'relax', 'meditate',
  // Mindless tasks
  'clean', 'tidy', 'laundry', 'dishes', 'trash', 'water plants',
  // Administrative
  'renew', 'submit', 'form', 'paperwork', 'download',
  // Self-care
  'self-care', 'stretch', 'breathe', 'journal',
]

/**
 * Suggests an energy level based on task title keywords.
 * Returns null if no confident suggestion can be made.
 */
export function suggestEnergyLevel(title: string): EnergyLevel | null {
  const lowerTitle = title.toLowerCase()

  // Count keyword matches for each level
  let highScore = 0
  let mediumScore = 0
  let lowScore = 0

  for (const keyword of HIGH_ENERGY_KEYWORDS) {
    if (lowerTitle.includes(keyword)) highScore++
  }

  for (const keyword of MEDIUM_ENERGY_KEYWORDS) {
    if (lowerTitle.includes(keyword)) mediumScore++
  }

  for (const keyword of LOW_ENERGY_KEYWORDS) {
    if (lowerTitle.includes(keyword)) lowScore++
  }

  // Return the highest scoring level if there's a clear winner
  const maxScore = Math.max(highScore, mediumScore, lowScore)

  // Require at least one keyword match
  if (maxScore === 0) return null

  // If there's a tie, return null (not confident enough)
  const scores = [highScore, mediumScore, lowScore]
  const maxCount = scores.filter(s => s === maxScore).length
  if (maxCount > 1) return null

  if (highScore === maxScore) return EnergyLevel.HIGH
  if (mediumScore === maxScore) return EnergyLevel.MEDIUM
  if (lowScore === maxScore) return EnergyLevel.LOW

  return null
}

/**
 * Returns suggested energy level with confidence indicator.
 * Useful for UI to show suggestion strength.
 */
export function suggestEnergyWithConfidence(title: string): {
  energy: EnergyLevel | null
  confidence: 'high' | 'medium' | 'low' | null
  matchedKeywords: string[]
} {
  const lowerTitle = title.toLowerCase()
  const matchedKeywords: string[] = []

  let highScore = 0
  let mediumScore = 0
  let lowScore = 0

  for (const keyword of HIGH_ENERGY_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      highScore++
      matchedKeywords.push(keyword)
    }
  }

  for (const keyword of MEDIUM_ENERGY_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      mediumScore++
      matchedKeywords.push(keyword)
    }
  }

  for (const keyword of LOW_ENERGY_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      lowScore++
      matchedKeywords.push(keyword)
    }
  }

  const maxScore = Math.max(highScore, mediumScore, lowScore)

  if (maxScore === 0) {
    return { energy: null, confidence: null, matchedKeywords: [] }
  }

  // Determine confidence based on score and difference from second place
  const scores = [highScore, mediumScore, lowScore].sort((a, b) => b - a)
  const margin = scores[0] - scores[1]

  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (maxScore >= 3 && margin >= 2) confidence = 'high'
  else if (maxScore >= 2 || margin >= 1) confidence = 'medium'

  // Determine energy level
  let energy: EnergyLevel | null = null
  if (highScore === maxScore && margin > 0) energy = EnergyLevel.HIGH
  else if (mediumScore === maxScore && margin > 0) energy = EnergyLevel.MEDIUM
  else if (lowScore === maxScore && margin > 0) energy = EnergyLevel.LOW

  return { energy, confidence, matchedKeywords }
}
