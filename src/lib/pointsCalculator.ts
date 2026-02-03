// Points Calculator for Gentle Gamification System
// ADHD-friendly: frequent small wins, no punishment

export const POINT_VALUES = {
  STEP_COMPLETE: 5,
  TASK_COMPLETE: 25,
  HABIT_COMPLETE: 10,
  FIRST_TASK_TODAY: 10,
  MOMENTUM_3_DAY: 15,
  MOMENTUM_7_DAY: 50,
  WEEKLY_REFLECTION: 20,
  LEVEL_UP: 50,
} as const

// Level thresholds - designed for achievable progression
export const LEVEL_THRESHOLDS = [
  0,      // Level 1: Start
  100,    // Level 2: Sprout
  300,    // Level 3: Seedling
  600,    // Level 4: Small Plant
  1000,   // Level 5: Growing
  1500,   // Level 6: Budding
  2100,   // Level 7: Blooming
  2800,   // Level 8: Flowering
  3600,   // Level 9: Flourishing
  4500,   // Level 10: Full Garden (max)
] as const

export const GARDEN_STAGES = [
  'seed',
  'sprout',
  'seedling',
  'small-plant',
  'growing',
  'budding',
  'blooming',
  'flowering',
  'flourishing',
  'full-garden',
] as const

export type GardenStage = typeof GARDEN_STAGES[number]

/**
 * Calculate level from total lifetime points
 */
export function calculateLevel(lifetimePoints: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (lifetimePoints >= LEVEL_THRESHOLDS[i]) {
      return i + 1
    }
  }
  return 1
}

/**
 * Get garden stage for a level
 */
export function getGardenStage(level: number): GardenStage {
  const index = Math.min(level - 1, GARDEN_STAGES.length - 1)
  return GARDEN_STAGES[Math.max(0, index)]
}

/**
 * Get progress to next level as percentage
 */
export function getLevelProgress(lifetimePoints: number): {
  currentLevel: number
  nextLevel: number | null
  currentThreshold: number
  nextThreshold: number | null
  progress: number // 0-100
  pointsToNext: number | null
} {
  const currentLevel = calculateLevel(lifetimePoints)
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1]

  // Max level reached
  if (currentLevel >= LEVEL_THRESHOLDS.length) {
    return {
      currentLevel,
      nextLevel: null,
      currentThreshold,
      nextThreshold: null,
      progress: 100,
      pointsToNext: null,
    }
  }

  const nextThreshold = LEVEL_THRESHOLDS[currentLevel]
  const levelRange = nextThreshold - currentThreshold
  const pointsIntoLevel = lifetimePoints - currentThreshold
  const progress = Math.min(100, Math.round((pointsIntoLevel / levelRange) * 100))
  const pointsToNext = nextThreshold - lifetimePoints

  return {
    currentLevel,
    nextLevel: currentLevel + 1,
    currentThreshold,
    nextThreshold,
    progress,
    pointsToNext,
  }
}

/**
 * Check if earning points would trigger a level up
 */
export function wouldLevelUp(currentLifetime: number, pointsToAdd: number): boolean {
  const currentLevel = calculateLevel(currentLifetime)
  const newLevel = calculateLevel(currentLifetime + pointsToAdd)
  return newLevel > currentLevel
}

/**
 * Calculate momentum bonus based on consecutive days
 * No penalty for missed days - momentum just pauses
 */
export function calculateMomentumBonus(consecutiveDays: number): number {
  if (consecutiveDays >= 7) {
    return POINT_VALUES.MOMENTUM_7_DAY
  }
  if (consecutiveDays >= 3) {
    return POINT_VALUES.MOMENTUM_3_DAY
  }
  return 0
}

/**
 * Check if it's the first activity today
 */
export function isFirstActivityToday(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return true

  const last = new Date(lastActivityDate)
  const today = new Date()

  // Compare dates only (ignore time)
  return (
    last.getFullYear() !== today.getFullYear() ||
    last.getMonth() !== today.getMonth() ||
    last.getDate() !== today.getDate()
  )
}

/**
 * Update momentum days based on activity pattern
 * ADHD-friendly: missed days pause, don't reset
 */
export function updateMomentumDays(
  lastActivityDate: string | null,
  currentMomentumDays: number,
  pauseUntil: string | null
): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if on vacation mode
  if (pauseUntil) {
    const pauseDate = new Date(pauseUntil)
    pauseDate.setHours(0, 0, 0, 0)
    if (today <= pauseDate) {
      // Still on pause, maintain momentum
      return currentMomentumDays
    }
  }

  if (!lastActivityDate) {
    // First activity ever
    return 1
  }

  const last = new Date(lastActivityDate)
  last.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    // Same day, no change
    return currentMomentumDays
  } else if (diffDays === 1) {
    // Consecutive day! Increment
    return currentMomentumDays + 1
  } else {
    // Missed days - pause at 0, but don't shame
    // They can rebuild from 1
    return 1
  }
}

/**
 * Format points for display
 */
export function formatPoints(points: number): string {
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}k`
  }
  return points.toString()
}

/**
 * Get encouraging message for level up
 */
export function getLevelUpMessage(newLevel: number): string {
  const messages: Record<number, string> = {
    2: 'Your garden sprouted!',
    3: 'Growing nicely!',
    4: 'Look at you go!',
    5: 'Halfway to full bloom!',
    6: 'Buds are forming!',
    7: 'Beautiful blooms!',
    8: 'Flourishing garden!',
    9: 'Almost there!',
    10: 'Full garden achieved!',
  }
  return messages[newLevel] || `Level ${newLevel}!`
}
