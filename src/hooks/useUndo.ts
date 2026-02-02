'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Undo action types
 */
export type UndoActionType = 'toggle_step' | 'delete_task' | 'complete_task'

/**
 * An undoable action with the data needed to reverse it
 */
export interface UndoAction {
  id: string
  type: UndoActionType
  description: string
  timestamp: number
  // Data needed to perform the undo
  data: {
    taskId: string
    stepId?: string | number
    previousState?: unknown
  }
}

/**
 * Return type for the useUndo hook
 */
export interface UseUndoReturn {
  /** Current pending undo action (shown in toast) */
  pendingUndo: UndoAction | null
  /** Push a new undoable action */
  pushUndo: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void
  /** Execute the undo for the current pending action */
  executeUndo: () => void
  /** Dismiss the current undo toast without undoing */
  dismissUndo: () => void
}

// How long the undo toast is visible (ms)
const UNDO_TIMEOUT = 5000

/**
 * Hook for managing undo functionality
 *
 * Maintains a single pending undo action that can be executed
 * within a timeout window. After the timeout, the action is
 * committed and can no longer be undone.
 */
export function useUndo(
  onUndo: (action: UndoAction) => Promise<void>
): UseUndoReturn {
  const [pendingUndo, setPendingUndo] = useState<UndoAction | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const pushUndo = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const fullAction: UndoAction = {
      ...action,
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    }

    setPendingUndo(fullAction)

    // Auto-dismiss after timeout
    timeoutRef.current = setTimeout(() => {
      setPendingUndo(null)
    }, UNDO_TIMEOUT)
  }, [])

  const executeUndo = useCallback(async () => {
    if (!pendingUndo) return

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Execute the undo callback
    await onUndo(pendingUndo)

    // Clear the pending undo
    setPendingUndo(null)
  }, [pendingUndo, onUndo])

  const dismissUndo = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setPendingUndo(null)
  }, [])

  return {
    pendingUndo,
    pushUndo,
    executeUndo,
    dismissUndo,
  }
}
