'use client'

import { useState, useCallback } from 'react'
import type { Task } from '@/hooks/useUserData'
import type { SavedLocation } from '@/lib/location'

/**
 * Modal state management hook for GatherApp.
 * Consolidates all modal visibility state and their associated data.
 */

export interface ModalState {
  // Simple visibility modals
  showChatModal: boolean
  showUpgradeModal: boolean
  showKeyboardShortcuts: boolean
  showTemplateModal: boolean
  showFocusLauncher: boolean
  showHelpMePick: boolean
  showBrainDump: boolean
  showCoachNotes: boolean
  showMoodPicker: boolean
  showIntegrationSettings: boolean
  showJustOneThing: boolean

  // Location modals with associated data
  showLocationPicker: boolean
  editingLocation: SavedLocation | null
  showLocationTriggerPicker: boolean
  locationTriggerTaskId: string | null
  locationReminderTask: Task | null
  locationReminderLocation: SavedLocation | null

  // Context capture modal with associated data
  showContextCapture: boolean
  contextCaptureTask: Task | null
  taskViewStartTime: number | null
}

export interface ModalActions {
  // Simple toggles
  openChatModal: () => void
  closeChatModal: () => void
  openUpgradeModal: () => void
  closeUpgradeModal: () => void
  openKeyboardShortcuts: () => void
  closeKeyboardShortcuts: () => void
  openTemplateModal: () => void
  closeTemplateModal: () => void
  openFocusLauncher: () => void
  closeFocusLauncher: () => void
  openHelpMePick: () => void
  closeHelpMePick: () => void
  openBrainDump: () => void
  closeBrainDump: () => void
  openCoachNotes: () => void
  closeCoachNotes: () => void
  openMoodPicker: () => void
  closeMoodPicker: () => void
  openIntegrationSettings: () => void
  closeIntegrationSettings: () => void
  openJustOneThing: () => void
  closeJustOneThing: () => void

  // Location modals
  openLocationPicker: (location?: SavedLocation | null) => void
  closeLocationPicker: () => void
  openLocationTriggerPicker: (taskId: string) => void
  closeLocationTriggerPicker: () => void
  setLocationReminder: (task: Task, location: SavedLocation) => void
  clearLocationReminder: () => void

  // Context capture
  openContextCapture: (task: Task) => void
  closeContextCapture: () => void
  setTaskViewStartTime: (time: number | null) => void
}

export interface UseModalManagerReturn extends ModalState, ModalActions {}

export function useModalManager(): UseModalManagerReturn {
  // Simple visibility states
  const [showChatModal, setShowChatModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showFocusLauncher, setShowFocusLauncher] = useState(false)
  const [showHelpMePick, setShowHelpMePick] = useState(false)
  const [showBrainDump, setShowBrainDump] = useState(false)
  const [showCoachNotes, setShowCoachNotes] = useState(false)
  const [showMoodPicker, setShowMoodPicker] = useState(false)
  const [showIntegrationSettings, setShowIntegrationSettings] = useState(false)
  const [showJustOneThing, setShowJustOneThing] = useState(false)

  // Location modal states
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null)
  const [showLocationTriggerPicker, setShowLocationTriggerPicker] = useState(false)
  const [locationTriggerTaskId, setLocationTriggerTaskId] = useState<string | null>(null)
  const [locationReminderTask, setLocationReminderTask] = useState<Task | null>(null)
  const [locationReminderLocation, setLocationReminderLocation] = useState<SavedLocation | null>(null)

  // Context capture state
  const [showContextCapture, setShowContextCapture] = useState(false)
  const [contextCaptureTask, setContextCaptureTask] = useState<Task | null>(null)
  const [taskViewStartTime, setTaskViewStartTime] = useState<number | null>(null)

  // Simple toggle actions
  const openChatModal = useCallback(() => setShowChatModal(true), [])
  const closeChatModal = useCallback(() => setShowChatModal(false), [])
  const openUpgradeModal = useCallback(() => setShowUpgradeModal(true), [])
  const closeUpgradeModal = useCallback(() => setShowUpgradeModal(false), [])
  const openKeyboardShortcuts = useCallback(() => setShowKeyboardShortcuts(true), [])
  const closeKeyboardShortcuts = useCallback(() => setShowKeyboardShortcuts(false), [])
  const openTemplateModal = useCallback(() => setShowTemplateModal(true), [])
  const closeTemplateModal = useCallback(() => setShowTemplateModal(false), [])
  const openFocusLauncher = useCallback(() => setShowFocusLauncher(true), [])
  const closeFocusLauncher = useCallback(() => setShowFocusLauncher(false), [])
  const openHelpMePick = useCallback(() => setShowHelpMePick(true), [])
  const closeHelpMePick = useCallback(() => setShowHelpMePick(false), [])
  const openBrainDump = useCallback(() => setShowBrainDump(true), [])
  const closeBrainDump = useCallback(() => setShowBrainDump(false), [])
  const openCoachNotes = useCallback(() => setShowCoachNotes(true), [])
  const closeCoachNotes = useCallback(() => setShowCoachNotes(false), [])
  const openMoodPicker = useCallback(() => setShowMoodPicker(true), [])
  const closeMoodPicker = useCallback(() => setShowMoodPicker(false), [])
  const openIntegrationSettings = useCallback(() => setShowIntegrationSettings(true), [])
  const closeIntegrationSettings = useCallback(() => setShowIntegrationSettings(false), [])
  const openJustOneThing = useCallback(() => setShowJustOneThing(true), [])
  const closeJustOneThing = useCallback(() => setShowJustOneThing(false), [])

  // Location modal actions
  const openLocationPicker = useCallback((location?: SavedLocation | null) => {
    setEditingLocation(location ?? null)
    setShowLocationPicker(true)
  }, [])

  const closeLocationPicker = useCallback(() => {
    setShowLocationPicker(false)
    setEditingLocation(null)
  }, [])

  const openLocationTriggerPicker = useCallback((taskId: string) => {
    setLocationTriggerTaskId(taskId)
    setShowLocationTriggerPicker(true)
  }, [])

  const closeLocationTriggerPicker = useCallback(() => {
    setShowLocationTriggerPicker(false)
    setLocationTriggerTaskId(null)
  }, [])

  const setLocationReminder = useCallback((task: Task, location: SavedLocation) => {
    setLocationReminderTask(task)
    setLocationReminderLocation(location)
  }, [])

  const clearLocationReminder = useCallback(() => {
    setLocationReminderTask(null)
    setLocationReminderLocation(null)
  }, [])

  // Context capture actions
  const openContextCapture = useCallback((task: Task) => {
    setContextCaptureTask(task)
    setShowContextCapture(true)
  }, [])

  const closeContextCapture = useCallback(() => {
    setShowContextCapture(false)
    setContextCaptureTask(null)
  }, [])

  return {
    // State
    showChatModal,
    showUpgradeModal,
    showKeyboardShortcuts,
    showTemplateModal,
    showFocusLauncher,
    showHelpMePick,
    showBrainDump,
    showCoachNotes,
    showMoodPicker,
    showIntegrationSettings,
    showJustOneThing,
    showLocationPicker,
    editingLocation,
    showLocationTriggerPicker,
    locationTriggerTaskId,
    locationReminderTask,
    locationReminderLocation,
    showContextCapture,
    contextCaptureTask,
    taskViewStartTime,

    // Actions
    openChatModal,
    closeChatModal,
    openUpgradeModal,
    closeUpgradeModal,
    openKeyboardShortcuts,
    closeKeyboardShortcuts,
    openTemplateModal,
    closeTemplateModal,
    openFocusLauncher,
    closeFocusLauncher,
    openHelpMePick,
    closeHelpMePick,
    openBrainDump,
    closeBrainDump,
    openCoachNotes,
    closeCoachNotes,
    openMoodPicker,
    closeMoodPicker,
    openIntegrationSettings,
    closeIntegrationSettings,
    openJustOneThing,
    closeJustOneThing,
    openLocationPicker,
    closeLocationPicker,
    openLocationTriggerPicker,
    closeLocationTriggerPicker,
    setLocationReminder,
    clearLocationReminder,
    openContextCapture,
    closeContextCapture,
    setTaskViewStartTime,
  }
}
