'use client'

import { useEffect, useState } from 'react'
import { XPGain, Achievement } from '@/hooks/useGameification'

interface XPBarProps {
  xp: number
  level: number
  title: string
  progress: number
  xpToNext: number
  compact?: boolean
}

/**
 * XP progress bar showing level and progress to next level
 */
export function XPBar({ xp, level, title, progress, xpToNext, compact = false }: XPBarProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-accent">Lv.{level}</span>
          <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progress, 6)}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-text-muted">{xp} XP</span>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-lg font-bold text-accent">{level}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-text">{title}</div>
            <div className="text-xs text-text-muted">{xp.toLocaleString()} XP total</div>
          </div>
        </div>
        {xpToNext > 0 && (
          <div className="text-right">
            <div className="text-xs text-text-muted">{xpToNext} XP to level {level + 1}</div>
          </div>
        )}
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progress, 3)}%` }}
        />
      </div>
    </div>
  )
}

interface XPPopupProps {
  gain: XPGain
  onComplete: () => void
}

/**
 * Floating XP gain notification
 */
export function XPPopup({ gain, onComplete }: XPPopupProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onComplete, 300)
    }, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-accent text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <span className="font-bold">+{gain.amount} XP</span>
        {gain.combo && gain.combo > 1 && (
          <span className="text-sm opacity-90">({gain.combo}x combo!)</span>
        )}
      </div>
    </div>
  )
}

interface ComboIndicatorProps {
  combo: number
}

/**
 * Combo counter shown during active combo
 */
export function ComboIndicator({ combo }: ComboIndicatorProps) {
  if (combo < 2) return null

  return (
    <div className="fixed bottom-6 right-4 z-40 pointer-events-none">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 rounded-full shadow-lg animate-pulse">
        <span className="font-bold">{combo}x</span>
        <span className="text-sm ml-1">COMBO</span>
      </div>
    </div>
  )
}

interface LevelUpModalProps {
  oldLevel: number
  newLevel: number
  title: string
  onClose: () => void
}

/**
 * Level up celebration modal
 */
export function LevelUpModal({ oldLevel, newLevel, title, onClose }: LevelUpModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-elevated rounded-2xl p-8 text-center max-w-sm mx-4 animate-rise">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-text mb-2">Level Up!</h2>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-3xl text-text-muted">{oldLevel}</span>
          <span className="text-2xl text-text-muted">→</span>
          <span className="text-4xl font-bold text-accent">{newLevel}</span>
        </div>
        <p className="text-lg text-text-soft mb-6">{title}</p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
        >
          Awesome!
        </button>
      </div>
    </div>
  )
}

interface AchievementModalProps {
  achievement: Achievement
  onClose: () => void
}

/**
 * Achievement unlock modal
 */
export function AchievementModal({ achievement, onClose }: AchievementModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-elevated rounded-2xl p-8 text-center max-w-sm mx-4 animate-rise">
        <div className="text-6xl mb-4">{achievement.icon}</div>
        <div className="text-xs font-medium text-accent uppercase tracking-wider mb-2">
          Achievement Unlocked
        </div>
        <h2 className="text-xl font-bold text-text mb-2">{achievement.title}</h2>
        <p className="text-sm text-text-soft mb-4">{achievement.description}</p>
        <div className="text-accent font-medium mb-6">+{achievement.xpReward} XP</div>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
        >
          Nice!
        </button>
      </div>
    </div>
  )
}

interface AchievementGridProps {
  achievements: Array<Achievement & { unlocked: boolean }>
}

/**
 * Grid of all achievements
 */
export function AchievementGrid({ achievements }: AchievementGridProps) {
  const unlocked = achievements.filter(a => a.unlocked)
  const locked = achievements.filter(a => !a.unlocked)

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-muted">
        {unlocked.length} of {achievements.length} unlocked
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {achievements.map(achievement => (
          <div
            key={achievement.id}
            className={`relative aspect-square rounded-xl flex items-center justify-center text-2xl transition-all ${
              achievement.unlocked
                ? 'bg-accent/10 border border-accent/30'
                : 'bg-surface border border-border opacity-40 grayscale'
            }`}
            title={`${achievement.title}: ${achievement.description}`}
          >
            {achievement.icon}
            {!achievement.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center">
                  <span className="text-xs text-text-muted">?</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
