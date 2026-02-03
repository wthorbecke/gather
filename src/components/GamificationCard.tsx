'use client'

import { useState } from 'react'
import { useRewards, RewardsCatalogItem } from '@/hooks/useRewards'
import { ProgressGarden } from './ProgressGarden'
import { LevelUpCelebration } from './MomentumPoints'
import { Modal } from './Modal'
import { CloseButton } from './CloseButton'

interface GamificationCardProps {
  userId: string | null
  isDemo?: boolean
}

// Minimal inline indicator - subtle, not card-like
export function GamificationIndicator({ userId, isDemo = false }: GamificationCardProps) {
  const rewards = useRewards(userId, isDemo)
  const [showRewardsModal, setShowRewardsModal] = useState(false)
  const [levelUpEvent, setLevelUpEvent] = useState<{ level: number; message: string } | null>(null)

  // Don't show if still loading
  if (rewards.isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-2">
        <div className="h-4 w-12 rounded bg-border" />
        <div className="h-4 w-16 rounded bg-border" />
      </div>
    )
  }

  return (
    <>
      {/* Minimal inline indicator */}
      <button
        onClick={() => setShowRewardsModal(true)}
        className="
          flex items-center gap-2 text-sm text-text-muted
          hover:text-text transition-colors duration-150
          py-1 px-2 -mx-2 rounded-md hover:bg-surface
        "
        aria-label="View your progress and rewards"
      >
        <span className="font-medium text-text-soft">Lvl {rewards.level}</span>
        <span className="text-xs opacity-60">·</span>
        <span className="text-text-muted">{rewards.formattedPoints} pts</span>
        {rewards.momentumDays > 0 && (
          <>
            <span className="text-xs opacity-60">·</span>
            <span className="text-text-muted">{rewards.momentumDays}d streak</span>
          </>
        )}
      </button>

      {/* Level up celebration */}
      {levelUpEvent && (
        <LevelUpCelebration
          level={levelUpEvent.level}
          message={levelUpEvent.message}
          onComplete={() => setLevelUpEvent(null)}
        />
      )}

      {/* Full details modal - garden visualization accessible here */}
      <Modal
        isOpen={showRewardsModal}
        onClose={() => setShowRewardsModal(false)}
        title="Your Progress"
      >
        <RewardsModalContent
          rewards={rewards}
          onClose={() => setShowRewardsModal(false)}
        />
      </Modal>
    </>
  )
}

// Keep the card version for backwards compatibility
export function GamificationCard({ userId, isDemo = false }: GamificationCardProps) {
  return <GamificationIndicator userId={userId} isDemo={isDemo} />
}

// Modal content component
function RewardsModalContent({
  rewards,
  onClose,
}: {
  rewards: ReturnType<typeof useRewards>
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'progress' | 'rewards'>('progress')

  return (
    <div className="space-y-4">
      {/* Close button */}
      <div className="absolute top-4 right-4">
        <CloseButton onClick={onClose} />
      </div>

      {/* Garden display */}
      <div className="flex flex-col items-center py-4">
        <ProgressGarden
          stage={rewards.gardenStage}
          level={rewards.level}
          progress={rewards.levelProgress.progress}
          size="lg"
        />
        <div className="mt-3 text-center">
          <div className="text-2xl font-bold text-text">Level {rewards.level}</div>
          <div className="text-sm text-text-soft">
            {rewards.points.toLocaleString()} momentum points
          </div>
        </div>
      </div>

      {/* Progress bar to next level */}
      {rewards.levelProgress.pointsToNext !== null && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-text-muted">
            <span>Level {rewards.level}</span>
            <span>Level {rewards.levelProgress.nextLevel}</span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${rewards.levelProgress.progress}%` }}
            />
          </div>
          <div className="text-center text-xs text-text-muted">
            {rewards.levelProgress.pointsToNext} points to next level
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('progress')}
          className={`
            px-4 py-2 text-sm font-medium
            border-b-2 -mb-px
            transition-colors
            ${activeTab === 'progress'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
            }
          `}
        >
          Progress
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`
            px-4 py-2 text-sm font-medium
            border-b-2 -mb-px
            transition-colors
            ${activeTab === 'rewards'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
            }
          `}
        >
          Rewards ({rewards.unlockedRewards.length}/{rewards.catalog.length})
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'progress' ? (
        <div className="space-y-4">
          {/* Momentum days */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
            <div>
              <div className="text-sm font-medium text-text">Momentum</div>
              <div className="text-xs text-text-muted">Days active in a row</div>
            </div>
            <div className="text-2xl font-bold text-success">
              {rewards.momentumDays}
            </div>
          </div>

          {/* How to earn points */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
              How to earn points
            </div>
            <div className="space-y-1.5 text-sm">
              <PointsRow action="Complete a step" points={5} />
              <PointsRow action="Finish a task" points={25} />
              <PointsRow action="Complete a habit" points={10} />
              <PointsRow action="First task of the day" points={10} bonus />
              <PointsRow action="3-day momentum" points={15} bonus />
              <PointsRow action="7-day momentum" points={50} bonus />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {/* Group rewards by type */}
          <RewardGroup
            title="Accent Colors"
            items={rewards.catalog.filter(r => r.type === 'accent_color')}
            unlockedIds={rewards.unlockedRewards}
            lifetimePoints={rewards.lifetimePoints}
            onUnlock={rewards.unlockReward}
            activeId={rewards.activeAccent}
            onSetActive={rewards.setActiveAccent}
          />
          <RewardGroup
            title="Themes"
            items={rewards.catalog.filter(r => r.type === 'theme')}
            unlockedIds={rewards.unlockedRewards}
            lifetimePoints={rewards.lifetimePoints}
            onUnlock={rewards.unlockReward}
            activeId={rewards.activeTheme}
            onSetActive={rewards.setActiveTheme}
          />
          <RewardGroup
            title="Celebrations"
            items={rewards.catalog.filter(r => r.type === 'celebration')}
            unlockedIds={rewards.unlockedRewards}
            lifetimePoints={rewards.lifetimePoints}
            onUnlock={rewards.unlockReward}
          />
        </div>
      )}

      {/* Footer note */}
      <div className="text-center text-xs text-text-muted pt-2 border-t border-border">
        Points never expire. Missed days pause your momentum - they never reset.
      </div>
    </div>
  )
}

// Helper component for points row
function PointsRow({
  action,
  points,
  bonus = false,
}: {
  action: string
  points: number
  bonus?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-soft">{action}</span>
      <span className={`font-medium ${bonus ? 'text-accent' : 'text-success'}`}>
        +{points}
      </span>
    </div>
  )
}

// Helper component for reward groups
function RewardGroup({
  title,
  items,
  unlockedIds,
  lifetimePoints,
  onUnlock,
  activeId,
  onSetActive,
}: {
  title: string
  items: RewardsCatalogItem[]
  unlockedIds: string[]
  lifetimePoints: number
  onUnlock: (id: string) => Promise<boolean>
  activeId?: string | null
  onSetActive?: (id: string | null) => Promise<void>
}) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => {
          const isUnlocked = unlockedIds.includes(item.id) || item.points_required === 0
          const canUnlock = lifetimePoints >= item.points_required
          const isActive = activeId === item.id

          return (
            <button
              key={item.id}
              onClick={async () => {
                if (isUnlocked && onSetActive) {
                  await onSetActive(isActive ? null : item.id)
                } else if (canUnlock) {
                  await onUnlock(item.id)
                }
              }}
              disabled={!isUnlocked && !canUnlock}
              className={`
                p-3 rounded-lg text-left
                transition-all duration-150
                ${isUnlocked
                  ? isActive
                    ? 'bg-accent/10 border-2 border-accent'
                    : 'bg-surface border border-border hover:border-accent/50'
                  : canUnlock
                    ? 'bg-surface border border-border hover:bg-card-hover cursor-pointer'
                    : 'bg-surface/50 border border-border/50 opacity-60'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">
                  {item.name}
                </span>
                {isUnlocked ? (
                  isActive ? (
                    <span className="text-xs text-accent font-medium">Active</span>
                  ) : (
                    <span className="text-xs text-success">✓</span>
                  )
                ) : (
                  <span className="text-xs text-text-muted">
                    {item.points_required} pts
                  </span>
                )}
              </div>
              <div className="text-xs text-text-muted mt-0.5 line-clamp-1">
                {item.description}
              </div>
              {!isUnlocked && canUnlock && (
                <div className="text-xs text-accent mt-1">
                  Tap to unlock
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
