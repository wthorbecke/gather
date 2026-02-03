'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  POINT_VALUES,
  calculateLevel,
  getGardenStage,
  getLevelProgress,
  wouldLevelUp,
  isFirstActivityToday,
  updateMomentumDays,
  calculateMomentumBonus,
  formatPoints,
  getLevelUpMessage,
  type GardenStage,
} from '@/lib/pointsCalculator'

export interface RewardsCatalogItem {
  id: string
  name: string
  description: string
  type: 'theme' | 'accent_color' | 'celebration' | 'feature'
  points_required: number
  preview_data: Record<string, unknown>
  sort_order: number
}

export interface RewardsState {
  points: number
  lifetimePoints: number
  level: number
  gardenStage: GardenStage
  unlockedRewards: string[]
  activeTheme: string
  activeAccent: string | null
  momentumDays: number
  lastActivityDate: string | null
  pauseUntil: string | null
  isLoading: boolean
  error: string | null
}

interface LevelUpEvent {
  newLevel: number
  message: string
}

export interface UseRewardsReturn extends RewardsState {
  // Actions
  earnPoints: (
    amount: number,
    actionType: string,
    taskId?: string,
    description?: string
  ) => Promise<LevelUpEvent | null>
  unlockReward: (rewardId: string) => Promise<boolean>
  setActiveTheme: (themeId: string | null) => Promise<void>
  setActiveAccent: (accentId: string | null) => Promise<void>
  pauseMomentum: (untilDate: Date | null) => Promise<void>
  // Computed
  levelProgress: ReturnType<typeof getLevelProgress>
  formattedPoints: string
  catalog: RewardsCatalogItem[]
  availableRewards: RewardsCatalogItem[]
  lockedRewards: RewardsCatalogItem[]
  // Demo mode support
  isDemo: boolean
}

const DEMO_REWARDS_KEY = 'gather:demo_rewards'

function getDemoRewards(): RewardsState {
  if (typeof window === 'undefined') {
    return getDefaultState()
  }
  const stored = localStorage.getItem(DEMO_REWARDS_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return getDefaultState()
    }
  }
  return getDefaultState()
}

function saveDemoRewards(state: Partial<RewardsState>) {
  if (typeof window === 'undefined') return
  const current = getDemoRewards()
  const updated = { ...current, ...state }
  localStorage.setItem(DEMO_REWARDS_KEY, JSON.stringify(updated))
}

function getDefaultState(): RewardsState {
  return {
    points: 0,
    lifetimePoints: 0,
    level: 1,
    gardenStage: 'seed',
    unlockedRewards: ['celebration-confetti'],
    activeTheme: 'default',
    activeAccent: null,
    momentumDays: 0,
    lastActivityDate: null,
    pauseUntil: null,
    isLoading: false,
    error: null,
  }
}

// Default catalog for demo mode
const DEFAULT_CATALOG: RewardsCatalogItem[] = [
  { id: 'accent-sage', name: 'Sage Accent', description: 'A calming green accent color', type: 'accent_color', points_required: 100, preview_data: { accent: '#6B9080' }, sort_order: 1 },
  { id: 'accent-lavender', name: 'Lavender Accent', description: 'A gentle purple accent', type: 'accent_color', points_required: 200, preview_data: { accent: '#9B8BB4' }, sort_order: 2 },
  { id: 'accent-ocean', name: 'Ocean Accent', description: 'A deep blue accent', type: 'accent_color', points_required: 300, preview_data: { accent: '#5B8FAF' }, sort_order: 3 },
  { id: 'accent-gold', name: 'Gold Accent', description: 'A warm golden accent', type: 'accent_color', points_required: 400, preview_data: { accent: '#D4A84B' }, sort_order: 4 },
  { id: 'theme-forest', name: 'Forest Theme', description: 'Deep greens and natural browns', type: 'theme', points_required: 500, preview_data: { accent: '#7CB37C' }, sort_order: 10 },
  { id: 'theme-midnight', name: 'Midnight Theme', description: 'Deep blues with starlight accents', type: 'theme', points_required: 750, preview_data: { accent: '#8BB4E8' }, sort_order: 11 },
  { id: 'theme-sunrise', name: 'Sunrise Theme', description: 'Warm oranges and soft yellows', type: 'theme', points_required: 1000, preview_data: { accent: '#E8A990' }, sort_order: 12 },
  { id: 'celebration-confetti', name: 'Classic Confetti', description: 'The default colorful celebration', type: 'celebration', points_required: 0, preview_data: { type: 'confetti' }, sort_order: 20 },
  { id: 'celebration-sparkle', name: 'Sparkle Burst', description: 'Elegant sparkle animation', type: 'celebration', points_required: 250, preview_data: { type: 'sparkle' }, sort_order: 21 },
  { id: 'celebration-fireworks', name: 'Mini Fireworks', description: 'Tiny firework bursts', type: 'celebration', points_required: 500, preview_data: { type: 'fireworks' }, sort_order: 22 },
  { id: 'celebration-garden', name: 'Garden Bloom', description: 'Flowers bloom around completed items', type: 'celebration', points_required: 750, preview_data: { type: 'garden_bloom' }, sort_order: 23 },
  { id: 'feature-sounds', name: 'Completion Sounds', description: 'Optional soft sounds on task completion', type: 'feature', points_required: 150, preview_data: { feature: 'completion_sounds' }, sort_order: 30 },
  { id: 'feature-quotes', name: 'Daily Quotes', description: 'Inspiring quotes in the home view', type: 'feature', points_required: 300, preview_data: { feature: 'daily_quotes' }, sort_order: 31 },
]

export function useRewards(userId: string | null, isDemo = false): UseRewardsReturn {
  const [state, setState] = useState<RewardsState>(getDefaultState())
  const [catalog, setCatalog] = useState<RewardsCatalogItem[]>(DEFAULT_CATALOG)

  // Load rewards data
  useEffect(() => {
    if (isDemo) {
      setState(getDemoRewards())
      return
    }

    if (!userId) {
      setState(getDefaultState())
      return
    }

    const loadRewards = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      try {
        
        // Load user rewards
        const { data: rewards, error: rewardsError } = await supabase
          .from('user_rewards')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (rewardsError && rewardsError.code !== 'PGRST116') {
          throw rewardsError
        }

        // Load catalog
        const { data: catalogData, error: catalogError } = await supabase
          .from('rewards_catalog')
          .select('*')
          .order('sort_order')

        if (catalogError) {
          console.warn('Failed to load rewards catalog:', catalogError)
        } else if (catalogData) {
          setCatalog(catalogData)
        }

        if (rewards) {
          setState({
            points: rewards.momentum_points || 0,
            lifetimePoints: rewards.lifetime_points || 0,
            level: rewards.current_level || 1,
            gardenStage: getGardenStage(rewards.current_level || 1),
            unlockedRewards: rewards.unlocked_themes || ['celebration-confetti'],
            activeTheme: rewards.active_theme || 'default',
            activeAccent: rewards.active_accent || null,
            momentumDays: rewards.momentum_days || 0,
            lastActivityDate: rewards.last_activity_date || null,
            pauseUntil: rewards.pause_streak_until || null,
            isLoading: false,
            error: null,
          })
        } else {
          // Create initial rewards record
          const { error: insertError } = await supabase
            .from('user_rewards')
            .insert({ user_id: userId })

          if (insertError) {
            console.warn('Failed to create rewards record:', insertError)
          }

          setState({ ...getDefaultState(), isLoading: false })
        }
      } catch (err) {
        console.error('Failed to load rewards:', err)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load rewards',
        }))
      }
    }

    loadRewards()
  }, [userId, isDemo])

  // Earn points action
  const earnPoints = useCallback(
    async (
      amount: number,
      actionType: string,
      taskId?: string,
      description?: string
    ): Promise<LevelUpEvent | null> => {
      const currentLifetime = state.lifetimePoints
      const willLevelUp = wouldLevelUp(currentLifetime, amount)

      // Check for first activity today bonus
      let totalPoints = amount
      let bonusDescription = description

      if (isFirstActivityToday(state.lastActivityDate)) {
        totalPoints += POINT_VALUES.FIRST_TASK_TODAY
        bonusDescription = (bonusDescription || '') + ' (+10 first today bonus)'
      }

      // Calculate new values
      const newLifetimePoints = currentLifetime + totalPoints
      const newLevel = calculateLevel(newLifetimePoints)
      const newGardenStage = getGardenStage(newLevel)
      const newMomentumDays = updateMomentumDays(
        state.lastActivityDate,
        state.momentumDays,
        state.pauseUntil
      )

      // Check for momentum bonus
      const momentumBonus = calculateMomentumBonus(newMomentumDays)
      if (momentumBonus > 0 && newMomentumDays !== state.momentumDays) {
        totalPoints += momentumBonus
      }

      // Level up bonus
      if (willLevelUp) {
        totalPoints += POINT_VALUES.LEVEL_UP
      }

      const newPoints = state.points + totalPoints
      const today = new Date().toISOString().split('T')[0]

      // Update state
      const newState: Partial<RewardsState> = {
        points: newPoints,
        lifetimePoints: newLifetimePoints + (willLevelUp ? POINT_VALUES.LEVEL_UP : 0),
        level: newLevel,
        gardenStage: newGardenStage,
        momentumDays: newMomentumDays,
        lastActivityDate: today,
      }

      setState(prev => ({ ...prev, ...newState }))

      if (isDemo) {
        saveDemoRewards(newState)
      } else if (userId) {
        try {
          
          // Update user rewards
          await supabase
            .from('user_rewards')
            .update({
              momentum_points: newPoints,
              lifetime_points: newLifetimePoints + (willLevelUp ? POINT_VALUES.LEVEL_UP : 0),
              current_level: newLevel,
              garden_stage: GARDEN_STAGES.indexOf(newGardenStage) + 1,
              momentum_days: newMomentumDays,
              last_activity_date: today,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)

          // Log transaction
          await supabase.from('point_transactions').insert({
            user_id: userId,
            points: totalPoints,
            action_type: actionType,
            task_id: taskId || null,
            description: bonusDescription || null,
          })
        } catch (err) {
          console.error('Failed to save points:', err)
        }
      }

      if (willLevelUp) {
        return {
          newLevel,
          message: getLevelUpMessage(newLevel),
        }
      }

      return null
    },
    [state, userId, isDemo]
  )

  // Unlock reward action
  const unlockReward = useCallback(
    async (rewardId: string): Promise<boolean> => {
      const reward = catalog.find(r => r.id === rewardId)
      if (!reward) return false

      // Check if already unlocked
      if (state.unlockedRewards.includes(rewardId)) return true

      // Check if enough points
      if (state.lifetimePoints < reward.points_required) return false

      const newUnlocked = [...state.unlockedRewards, rewardId]
      setState(prev => ({ ...prev, unlockedRewards: newUnlocked }))

      if (isDemo) {
        saveDemoRewards({ unlockedRewards: newUnlocked })
      } else if (userId) {
        try {
                    await supabase
            .from('user_rewards')
            .update({
              unlocked_themes: newUnlocked,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        } catch (err) {
          console.error('Failed to unlock reward:', err)
          return false
        }
      }

      return true
    },
    [catalog, state.unlockedRewards, state.lifetimePoints, userId, isDemo]
  )

  // Set active theme
  const setActiveTheme = useCallback(
    async (themeId: string | null) => {
      const theme = themeId || 'default'
      if (!state.unlockedRewards.includes(theme) && theme !== 'default') return

      setState(prev => ({ ...prev, activeTheme: theme }))

      if (isDemo) {
        saveDemoRewards({ activeTheme: theme })
      } else if (userId) {
        try {
          await supabase
            .from('user_rewards')
            .update({
              active_theme: theme,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        } catch (err) {
          console.error('Failed to set theme:', err)
        }
      }
    },
    [state.unlockedRewards, userId, isDemo]
  )

  // Set active accent
  const setActiveAccent = useCallback(
    async (accentId: string | null) => {
      if (accentId && !state.unlockedRewards.includes(accentId)) return

      setState(prev => ({ ...prev, activeAccent: accentId }))

      if (isDemo) {
        saveDemoRewards({ activeAccent: accentId })
      } else if (userId) {
        try {
                    await supabase
            .from('user_rewards')
            .update({
              active_accent: accentId,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        } catch (err) {
          console.error('Failed to set accent:', err)
        }
      }
    },
    [state.unlockedRewards, userId, isDemo]
  )

  // Pause momentum (vacation mode)
  const pauseMomentum = useCallback(
    async (untilDate: Date | null) => {
      const pauseUntil = untilDate ? untilDate.toISOString().split('T')[0] : null

      setState(prev => ({ ...prev, pauseUntil }))

      if (isDemo) {
        saveDemoRewards({ pauseUntil })
      } else if (userId) {
        try {
                    await supabase
            .from('user_rewards')
            .update({
              pause_streak_until: pauseUntil,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        } catch (err) {
          console.error('Failed to pause momentum:', err)
        }
      }
    },
    [userId, isDemo]
  )

  // Computed values
  const levelProgress = useMemo(
    () => getLevelProgress(state.lifetimePoints),
    [state.lifetimePoints]
  )

  const formattedPoints = useMemo(
    () => formatPoints(state.points),
    [state.points]
  )

  const availableRewards = useMemo(
    () => catalog.filter(r => state.lifetimePoints >= r.points_required),
    [catalog, state.lifetimePoints]
  )

  const lockedRewards = useMemo(
    () => catalog.filter(r => state.lifetimePoints < r.points_required),
    [catalog, state.lifetimePoints]
  )

  return {
    ...state,
    earnPoints,
    unlockReward,
    setActiveTheme,
    setActiveAccent,
    pauseMomentum,
    levelProgress,
    formattedPoints,
    catalog,
    availableRewards,
    lockedRewards,
    isDemo,
  }
}

// Garden stage names constant for DB storage
const GARDEN_STAGES = [
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
