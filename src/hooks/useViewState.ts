'use client'

import { useState, useCallback } from 'react'

// View modes
export type ViewMode = 'list' | 'day' | 'stack'

export interface ViewState {
  currentTaskId: string | null
  showIntegrationSettings: boolean
  viewMode: ViewMode
  selectedDate: Date  // For day view
  // Legacy compatibility
  useStackView: boolean
}

export interface ViewStateActions {
  setCurrentTaskId: (taskId: string | null) => void
  setShowIntegrationSettings: (show: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setSelectedDate: (date: Date) => void
  // Legacy compatibility
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

  // View mode (list, day, stack)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Selected date for day view
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // Legacy compatibility: useStackView maps to viewMode === 'stack'
  const useStackView = viewMode === 'stack'

  const setUseStackView = useCallback((use: boolean) => {
    setViewMode(use ? 'stack' : 'list')
  }, [])

  const toggleStackView = useCallback(() => {
    setViewMode(prev => prev === 'stack' ? 'list' : 'stack')
  }, [])

  return {
    // State
    currentTaskId,
    showIntegrationSettings,
    viewMode,
    selectedDate,
    useStackView, // Legacy

    // Actions
    setCurrentTaskId,
    setShowIntegrationSettings,
    setViewMode,
    setSelectedDate,
    setUseStackView, // Legacy
    toggleStackView,
  }
}
