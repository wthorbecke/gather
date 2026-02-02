'use client'

import { useState, useRef, useCallback, Dispatch, SetStateAction, MutableRefObject } from 'react'

export interface DuplicatePrompt {
  taskId: string
  taskTitle: string
  input: string
}

export interface DuplicateDetectionReturn {
  duplicatePrompt: DuplicatePrompt | null
  setDuplicatePrompt: Dispatch<SetStateAction<DuplicatePrompt | null>>
  bypassDuplicateRef: MutableRefObject<boolean>
  bypassNextCheck: () => void
}

/**
 * Hook for managing duplicate task detection state.
 *
 * Provides state and utilities for detecting and handling duplicate tasks:
 * - duplicatePrompt: Stores info about a detected duplicate (task ID, title, user input)
 * - bypassDuplicateRef: Ref to bypass duplicate check on next submission
 * - bypassNextCheck: Utility to set bypass flag before submitting
 *
 * Used when a user enters a task that matches an existing task title.
 */
export function useDuplicateDetection(): DuplicateDetectionReturn {
  // State for storing detected duplicate info
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null)

  // Ref to bypass duplicate detection on next check (e.g., when user chooses "Create new anyway")
  const bypassDuplicateRef = useRef<boolean>(false)

  // Utility to set bypass flag - useful before re-submitting after user confirms
  const bypassNextCheck = useCallback(() => {
    bypassDuplicateRef.current = true
  }, [])

  return {
    duplicatePrompt,
    setDuplicatePrompt,
    bypassDuplicateRef,
    bypassNextCheck,
  }
}
