'use client'

import { useState, useEffect, useCallback } from 'react'

// XP rewards
const XP_REWARDS = {
  completeStep: 10,
  completeTask: 50,
  quickWin: 15,        // Bonus for tasks with <3 steps
  streakDay: 25,       // Daily streak bonus
  focusModeComplete: 5, // Bonus for using focus mode
  comboMultiplier: 0.1, // 10% bonus per combo level
}

// Level thresholds - each level requires more XP
const LEVELS = [
  { level: 1, xpRequired: 0, title: 'Getting Started' },
  { level: 2, xpRequired: 100, title: 'Building Momentum' },
  { level: 3, xpRequired: 250, title: 'Finding Flow' },
  { level: 4, xpRequired: 500, title: 'Task Tackler' },
  { level: 5, xpRequired: 800, title: 'Step Slayer' },
  { level: 6, xpRequired: 1200, title: 'Focus Fighter' },
  { level: 7, xpRequired: 1800, title: 'Productivity Pro' },
  { level: 8, xpRequired: 2500, title: 'Goal Getter' },
  { level: 9, xpRequired: 3500, title: 'Achievement Hunter' },
  { level: 10, xpRequired: 5000, title: 'Task Master' },
  { level: 11, xpRequired: 7000, title: 'Legendary' },
  { level: 12, xpRequired: 10000, title: 'Unstoppable' },
]

// Achievements
export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  xpReward: number
  condition: (stats: GameStats) => boolean
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first step',
    icon: '👟',
    xpReward: 25,
    condition: (stats) => stats.totalStepsCompleted >= 1,
  },
  {
    id: 'first_task',
    title: 'Task Complete',
    description: 'Finish your first task',
    icon: '✅',
    xpReward: 50,
    condition: (stats) => stats.totalTasksCompleted >= 1,
  },
  {
    id: 'streak_3',
    title: 'On a Roll',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    xpReward: 75,
    condition: (stats) => stats.longestStreak >= 3,
  },
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '⚡',
    xpReward: 150,
    condition: (stats) => stats.longestStreak >= 7,
  },
  {
    id: 'streak_30',
    title: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    icon: '👑',
    xpReward: 500,
    condition: (stats) => stats.longestStreak >= 30,
  },
  {
    id: 'steps_10',
    title: 'Getting Going',
    description: 'Complete 10 steps',
    icon: '🚶',
    xpReward: 50,
    condition: (stats) => stats.totalStepsCompleted >= 10,
  },
  {
    id: 'steps_50',
    title: 'Stepping Up',
    description: 'Complete 50 steps',
    icon: '🏃',
    xpReward: 100,
    condition: (stats) => stats.totalStepsCompleted >= 50,
  },
  {
    id: 'steps_100',
    title: 'Century Club',
    description: 'Complete 100 steps',
    icon: '💯',
    xpReward: 200,
    condition: (stats) => stats.totalStepsCompleted >= 100,
  },
  {
    id: 'steps_500',
    title: 'Step Legend',
    description: 'Complete 500 steps',
    icon: '🏆',
    xpReward: 500,
    condition: (stats) => stats.totalStepsCompleted >= 500,
  },
  {
    id: 'tasks_5',
    title: 'Task Starter',
    description: 'Complete 5 tasks',
    icon: '📋',
    xpReward: 75,
    condition: (stats) => stats.totalTasksCompleted >= 5,
  },
  {
    id: 'tasks_25',
    title: 'Task Pro',
    description: 'Complete 25 tasks',
    icon: '📊',
    xpReward: 200,
    condition: (stats) => stats.totalTasksCompleted >= 25,
  },
  {
    id: 'tasks_100',
    title: 'Task Titan',
    description: 'Complete 100 tasks',
    icon: '🎯',
    xpReward: 500,
    condition: (stats) => stats.totalTasksCompleted >= 100,
  },
  {
    id: 'focus_first',
    title: 'Focused',
    description: 'Complete a step in Focus Mode',
    icon: '🎯',
    xpReward: 25,
    condition: (stats) => stats.focusModeCompletions >= 1,
  },
  {
    id: 'focus_10',
    title: 'Deep Focus',
    description: 'Complete 10 steps in Focus Mode',
    icon: '🧘',
    xpReward: 100,
    condition: (stats) => stats.focusModeCompletions >= 10,
  },
  {
    id: 'combo_5',
    title: 'Combo Starter',
    description: 'Get a 5x combo',
    icon: '⚡',
    xpReward: 50,
    condition: (stats) => stats.highestCombo >= 5,
  },
  {
    id: 'combo_10',
    title: 'Combo King',
    description: 'Get a 10x combo',
    icon: '👑',
    xpReward: 150,
    condition: (stats) => stats.highestCombo >= 10,
  },
  {
    id: 'quick_wins_10',
    title: 'Quick Draw',
    description: 'Complete 10 quick win tasks',
    icon: '⚡',
    xpReward: 100,
    condition: (stats) => stats.quickWinsCompleted >= 10,
  },
  {
    id: 'level_5',
    title: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    xpReward: 100,
    condition: (stats) => stats.level >= 5,
  },
  {
    id: 'level_10',
    title: 'Task Master',
    description: 'Reach level 10',
    icon: '🌟',
    xpReward: 250,
    condition: (stats) => stats.level >= 10,
  },
]

export interface GameStats {
  xp: number
  level: number
  totalStepsCompleted: number
  totalTasksCompleted: number
  currentStreak: number
  longestStreak: number
  focusModeCompletions: number
  highestCombo: number
  currentCombo: number
  quickWinsCompleted: number
  lastActivityDate: string
  unlockedAchievements: string[]
}

const STORAGE_KEY = 'gather_game_stats'

const defaultStats: GameStats = {
  xp: 0,
  level: 1,
  totalStepsCompleted: 0,
  totalTasksCompleted: 0,
  currentStreak: 0,
  longestStreak: 0,
  focusModeCompletions: 0,
  highestCombo: 0,
  currentCombo: 0,
  quickWinsCompleted: 0,
  lastActivityDate: '',
  unlockedAchievements: [],
}

function loadStats(): GameStats {
  if (typeof window === 'undefined') return defaultStats
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultStats, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.warn('Failed to load game stats:', e)
  }
  return defaultStats
}

function saveStats(stats: GameStats) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch (e) {
    console.warn('Failed to save game stats:', e)
  }
}

function calculateLevel(xp: number): { level: number; title: string; progress: number; xpToNext: number } {
  let currentLevel = LEVELS[0]
  let nextLevel = LEVELS[1]

  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xpRequired) {
      currentLevel = LEVELS[i]
      nextLevel = LEVELS[i + 1] || LEVELS[i]
    }
  }

  const xpIntoLevel = xp - currentLevel.xpRequired
  const xpForLevel = nextLevel.xpRequired - currentLevel.xpRequired
  const progress = xpForLevel > 0 ? (xpIntoLevel / xpForLevel) * 100 : 100
  const xpToNext = nextLevel.xpRequired - xp

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    progress: Math.min(progress, 100),
    xpToNext: Math.max(xpToNext, 0),
  }
}

export interface XPGain {
  amount: number
  reason: string
  combo?: number
}

export function useGameification() {
  const [stats, setStats] = useState<GameStats>(defaultStats)
  const [recentXP, setRecentXP] = useState<XPGain | null>(null)
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)
  const [levelUp, setLevelUp] = useState<{ oldLevel: number; newLevel: number; title: string } | null>(null)

  // Load stats on mount
  useEffect(() => {
    setStats(loadStats())
  }, [])

  // Check for new achievements
  const checkAchievements = useCallback((currentStats: GameStats): Achievement[] => {
    const newlyUnlocked: Achievement[] = []

    for (const achievement of ACHIEVEMENTS) {
      if (!currentStats.unlockedAchievements.includes(achievement.id)) {
        if (achievement.condition(currentStats)) {
          newlyUnlocked.push(achievement)
        }
      }
    }

    return newlyUnlocked
  }, [])

  // Award XP with combo multiplier
  const awardXP = useCallback((baseAmount: number, reason: string, isCombo = true) => {
    setStats(prev => {
      const today = new Date().toISOString().split('T')[0]
      const isNewDay = prev.lastActivityDate !== today

      // Update streak
      let newStreak = prev.currentStreak
      if (isNewDay) {
        const lastDate = prev.lastActivityDate ? new Date(prev.lastActivityDate) : null
        const todayDate = new Date(today)
        if (lastDate) {
          const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          if (daysDiff === 1) {
            newStreak = prev.currentStreak + 1
          } else if (daysDiff > 1) {
            newStreak = 1
          }
        } else {
          newStreak = 1
        }
      }

      // Update combo
      const newCombo = isCombo ? prev.currentCombo + 1 : 0
      const comboBonus = isCombo ? Math.floor(baseAmount * XP_REWARDS.comboMultiplier * Math.min(newCombo, 10)) : 0
      const totalXP = baseAmount + comboBonus

      const newXP = prev.xp + totalXP
      const levelInfo = calculateLevel(newXP)
      const oldLevel = prev.level

      const newStats: GameStats = {
        ...prev,
        xp: newXP,
        level: levelInfo.level,
        currentCombo: newCombo,
        highestCombo: Math.max(prev.highestCombo, newCombo),
        currentStreak: newStreak,
        longestStreak: Math.max(prev.longestStreak, newStreak),
        lastActivityDate: today,
      }

      // Check for level up
      if (levelInfo.level > oldLevel) {
        setLevelUp({ oldLevel, newLevel: levelInfo.level, title: levelInfo.title })
      }

      // Check for new achievements
      const newAchievements = checkAchievements(newStats)
      if (newAchievements.length > 0) {
        // Award achievement XP
        const achievementXP = newAchievements.reduce((sum, a) => sum + a.xpReward, 0)
        newStats.xp += achievementXP
        newStats.unlockedAchievements = [
          ...prev.unlockedAchievements,
          ...newAchievements.map(a => a.id),
        ]
        // Show first new achievement
        setNewAchievement(newAchievements[0])
      }

      saveStats(newStats)
      setRecentXP({ amount: totalXP, reason, combo: newCombo > 1 ? newCombo : undefined })

      return newStats
    })
  }, [checkAchievements])

  // Complete a step
  const completeStep = useCallback((inFocusMode = false) => {
    setStats(prev => {
      const newStats = {
        ...prev,
        totalStepsCompleted: prev.totalStepsCompleted + 1,
        focusModeCompletions: inFocusMode ? prev.focusModeCompletions + 1 : prev.focusModeCompletions,
      }
      saveStats(newStats)
      return newStats
    })

    const baseXP = XP_REWARDS.completeStep + (inFocusMode ? XP_REWARDS.focusModeComplete : 0)
    awardXP(baseXP, inFocusMode ? 'Step completed in Focus Mode' : 'Step completed')
  }, [awardXP])

  // Complete a task
  const completeTask = useCallback((isQuickWin = false) => {
    setStats(prev => {
      const newStats = {
        ...prev,
        totalTasksCompleted: prev.totalTasksCompleted + 1,
        quickWinsCompleted: isQuickWin ? prev.quickWinsCompleted + 1 : prev.quickWinsCompleted,
      }
      saveStats(newStats)
      return newStats
    })

    const baseXP = XP_REWARDS.completeTask + (isQuickWin ? XP_REWARDS.quickWin : 0)
    awardXP(baseXP, isQuickWin ? 'Quick win completed!' : 'Task completed!')
  }, [awardXP])

  // Break combo (e.g., when user takes a break)
  const breakCombo = useCallback(() => {
    setStats(prev => {
      const newStats = { ...prev, currentCombo: 0 }
      saveStats(newStats)
      return newStats
    })
  }, [])

  // Clear notifications
  const clearRecentXP = useCallback(() => setRecentXP(null), [])
  const clearNewAchievement = useCallback(() => setNewAchievement(null), [])
  const clearLevelUp = useCallback(() => setLevelUp(null), [])

  // Get level info
  const levelInfo = calculateLevel(stats.xp)

  // Get all achievements with unlock status
  const achievements = ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: stats.unlockedAchievements.includes(a.id),
  }))

  return {
    stats,
    levelInfo,
    achievements,
    recentXP,
    newAchievement,
    levelUp,
    completeStep,
    completeTask,
    breakCombo,
    clearRecentXP,
    clearNewAchievement,
    clearLevelUp,
  }
}
