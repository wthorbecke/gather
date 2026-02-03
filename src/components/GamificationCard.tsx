'use client'

import { useState, useCallback } from 'react'
import { useRewards, RewardsCatalogItem } from '@/hooks/useRewards'
import { ProgressGarden } from './ProgressGarden'
import { MomentumPoints, LevelUpCelebration } from './MomentumPoints'
import { Modal } from './Modal'
import { CloseButton } from './CloseButton'

interface GamificationCardProps {
  userId: string | null
  isDemo?: boolean
}

export function GamificationCard({ userId, isDemo = false }: GamificationCardProps) {
  const rewards = useRewards(userId, isDemo)
  const [showRewardsModal, setShowRewardsModal] = useState(false)
  const [levelUpEvent, setLevelUpEvent] = useState<{ level: number; message: string } | null>(null)

  // Don't show if still loading or there was an error
  if (rewards.isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-card">
        <div className="w-12 h-12 rounded-full bg-border" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-20 rounded bg-border" />
          <div className="h-3 w-32 rounded bg-border" />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Compact inline display */}
      <div
        className="
          flex items-center gap-3 p-3
          rounded-xl bg-card border border-border-subtle
          cursor-pointer
          transition-all duration-200
          hover:bg-card-hover hover:border-border
        "
        onClick={() => setShowRewardsModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setShowRewardsModal(true)}
        aria-label="View your rewards and progress"
      >
        <ProgressGarden
          stage={rewards.gardenStage}
          level={rewards.level}
          progress={rewards.levelProgress.progress}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">
              Level {rewards.level}
            </span>
            <span className="text-xs text-text-muted">
              · {rewards.formattedPoints} pts
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden max-w-[100px]">
              <div
                className="h-full bg-success rounded-full transition-all duration-300"
                style={{ width: `${rewards.levelProgress.progress}%` }}
              />
            </div>
            {rewards.levelProgress.pointsToNext && (
              <span className="text-[10px] text-text-muted">
                {rewards.levelProgress.pointsToNext} to next
              </span>
            )}
          </div>
        </div>
        <span className="text-text-muted">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>

      {/* Level up celebration */}
      {levelUpEvent && (
        <LevelUpCelebration
          level={levelUpEvent.level}
          message={levelUpEvent.message}
          onComplete={() => setLevelUpEvent(null)}
        />
      )}

      {/* Rewards modal */}
      <Modal
        isOpen={showRewardsModal}
        onClose={() => setShowRewardsModal(false)}
        title="Your Garden"
      >
        <RewardsModalContent
          rewards={rewards}
          onClose={() => setShowRewardsModal(false)}
        />
      </Modal>
    </>
  )
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
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
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
      <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
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
