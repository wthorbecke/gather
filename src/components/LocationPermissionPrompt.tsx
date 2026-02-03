'use client'

import { useState } from 'react'

interface LocationPermissionPromptProps {
  onRequestPermission: () => Promise<boolean>
  onDismiss: () => void
}

/**
 * LocationPermissionPrompt - Prompt to request location access
 *
 * Shows a friendly explanation of why location is needed
 * and provides clear opt-in/opt-out options.
 */
export function LocationPermissionPrompt({
  onRequestPermission,
  onDismiss,
}: LocationPermissionPromptProps) {
  const [isRequesting, setIsRequesting] = useState(false)

  const handleEnable = async () => {
    setIsRequesting(true)
    await onRequestPermission()
    setIsRequesting(false)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-elevated border border-border rounded-2xl p-4 shadow-lg z-50 animate-fade-in">
      <div className="flex gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-text mb-1">
            Location reminders
          </p>
          <p className="text-sm text-text-soft">
            Get reminded of tasks when you arrive at or leave specific places.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleEnable}
          disabled={isRequesting}
          className="
            flex-1 py-2.5 min-h-[44px]
            bg-text text-white
            rounded-lg text-sm font-medium
            hover:opacity-90 transition-opacity duration-150
            disabled:opacity-50
            btn-press
          "
        >
          {isRequesting ? 'Requesting...' : 'Enable'}
        </button>
        <button
          onClick={onDismiss}
          className="
            px-3 py-2 min-h-[44px]
            text-text-muted text-sm
            hover:text-text transition-colors duration-150
            btn-press
          "
        >
          Not now
        </button>
      </div>

      <p className="text-xs text-text-muted mt-3">
        Your location is only used when the app is open. We never track you in the background.
      </p>
    </div>
  )
}
