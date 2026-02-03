'use client'

/**
 * Reusable skeleton loading components for consistent loading states.
 * Uses CSS animations defined in globals.css for smooth shimmer effect.
 */

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

/**
 * Basic skeleton line - use for text placeholders
 */
export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

/**
 * Skeleton for a task list item
 */
export function TaskListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border-subtle p-4"
          style={{ opacity: 1 - i * 0.2 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="w-4 h-4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for a step item
 */
export function StepSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border-subtle p-3"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <div className="flex items-start gap-3">
            <Skeleton className="w-[18px] h-[18px] rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for the AI card
 */
export function AICardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'var(--ai-bg)',
        border: '1px solid var(--ai-border)',
      }}
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>
    </div>
  )
}

/**
 * Skeleton for the input field
 */
export function InputSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-14 w-full rounded-md" />
    </div>
  )
}

/**
 * Full page skeleton for initial app load
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Skeleton header */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
        <div className="px-5 py-4">
          <div className="max-w-[540px] mx-auto">
            <div className="flex justify-between items-center">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="w-11 h-11 rounded-lg" />
                <Skeleton className="w-11 h-11 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Skeleton content */}
      <div className="px-5 py-6">
        <div className="max-w-[540px] mx-auto space-y-4">
          <InputSkeleton />
          <TaskListSkeleton count={3} />
        </div>
      </div>
    </div>
  )
}
