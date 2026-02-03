'use client'

import { SavedLocation, LocationTrigger, LocationTriggerType, formatLocationName } from '@/lib/location'

interface LocationBadgeProps {
  trigger: LocationTrigger
  location: SavedLocation | undefined
  onClick?: () => void
  size?: 'sm' | 'md'
}

/**
 * LocationBadge - Shows location trigger info on a task
 *
 * Displays the location name and trigger type (arriving/leaving)
 */
export function LocationBadge({
  trigger,
  location,
  onClick,
  size = 'sm',
}: LocationBadgeProps) {
  if (!trigger.enabled || !location) return null

  const locationName = formatLocationName(location)
  const isArriving = trigger.triggerType === LocationTriggerType.ARRIVING

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-1 gap-1'
    : 'text-sm px-2.5 py-1.5 gap-1.5'

  const iconSize = size === 'sm' ? 12 : 14

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center ${sizeClasses}
        bg-accent/10 text-accent
        rounded-md
        hover:bg-accent/20 transition-colors
        font-medium
      `}
      title={`Remind when ${isArriving ? 'arriving at' : 'leaving'} ${locationName}`}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="flex-shrink-0"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span className="truncate max-w-[80px]">
        {isArriving ? 'At' : 'Leaving'} {locationName}
      </span>
    </button>
  )
}

interface LocationBadgeInlineProps {
  trigger: LocationTrigger
  location: SavedLocation | undefined
}

/**
 * LocationBadgeInline - Compact inline version for task list items
 */
export function LocationBadgeInline({
  trigger,
  location,
}: LocationBadgeInlineProps) {
  if (!trigger.enabled || !location) return null

  const locationName = formatLocationName(location)
  const isArriving = trigger.triggerType === LocationTriggerType.ARRIVING

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-accent"
      title={`Remind when ${isArriving ? 'arriving at' : 'leaving'} ${locationName}`}
    >
      <svg
        width={10}
        height={10}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="flex-shrink-0"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span className="truncate">{locationName}</span>
    </span>
  )
}
