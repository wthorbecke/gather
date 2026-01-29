'use client'

import { useState, useCallback } from 'react'

export interface ViewState {
  currentTaskId: string | null
  showIntegrationSettings: boolean
  useStackView: boolean
}

export interface ViewStateActions {
  setCurrentTaskId: (taskId: string | null) => void
  setShowIntegrationSettings: (show: boolean) => void
  setUseStackView: (use: boolean) => void
  toggleStackView: () => void
}

/**
 * Hook for managing view state - current view, view transitions, modal states
 */
export function useViewState() {
  // View state
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  // Integration settings state
  const [showIntegrationSettings, setShowIntegrationSettings] = useState(false)

  // Stack view toggle (new UI experiment)
  const [useStackView, setUseStackView] = useState(true)

  const toggleStackView = useCallback(() => {
    setUseStackView(prev => !prev)
  }, [])

  return {
    // State
    currentTaskId,
    showIntegrationSettings,
    useStackView,

    // Actions
    setCurrentTaskId,
    setShowIntegrationSettings,
    setUseStackView,
    toggleStackView,
  }
}
