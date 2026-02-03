'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { hapticMedium } from '@/lib/haptics'

export interface SwipeGestureOptions {
  /** Threshold in pixels to trigger the action (default: 80) */
  threshold?: number
  /** Maximum vertical movement allowed before canceling horizontal swipe (default: 50) */
  maxVerticalMovement?: number
  /** Callback when swiped left past threshold */
  onSwipeLeft?: () => void
  /** Callback when swiped right past threshold */
  onSwipeRight?: () => void
  /** Callback for long press (default: 500ms) */
  onLongPress?: () => void
  /** Long press duration in ms (default: 500) */
  longPressDuration?: number
  /** Whether swipe gestures are enabled (default: true) */
  enabled?: boolean
  /** Whether to enable swipe left (default: true) */
  enableSwipeLeft?: boolean
  /** Whether to enable swipe right (default: true) */
  enableSwipeRight?: boolean
}

export interface SwipeState {
  /** Current horizontal offset */
  offsetX: number
  /** Whether the swipe is active */
  isSwiping: boolean
  /** Direction of current swipe: 'left', 'right', or null */
  direction: 'left' | 'right' | null
  /** Whether the threshold has been reached */
  thresholdReached: boolean
}

export interface SwipeGestureReturn {
  /** Ref to attach to the swipeable element */
  ref: React.RefObject<HTMLDivElement | null>
  /** Current swipe state */
  state: SwipeState
  /** Reset the swipe state */
  reset: () => void
}

/**
 * Hook for detecting swipe gestures on touch devices
 *
 * Features:
 * - Horizontal swipe detection (left/right)
 * - Threshold-based action triggering
 * - Long press detection
 * - Spring animation on release
 * - Prevents vertical scroll during horizontal swipe
 * - Only activates on touch devices
 */
export function useSwipeGesture(options: SwipeGestureOptions = {}): SwipeGestureReturn {
  const {
    threshold = 80,
    maxVerticalMovement = 50,
    onSwipeLeft,
    onSwipeRight,
    onLongPress,
    longPressDuration = 500,
    enabled = true,
    enableSwipeLeft = true,
    enableSwipeRight = true,
  } = options

  const ref = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasTriggeredRef = useRef(false)
  const thresholdFeedbackRef = useRef(false)

  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    isSwiping: false,
    direction: null,
    thresholdReached: false,
  })

  const reset = useCallback(() => {
    setState({
      offsetX: 0,
      isSwiping: false,
      direction: null,
      thresholdReached: false,
    })
    touchStartRef.current = null
    hasTriggeredRef.current = false
    thresholdFeedbackRef.current = false
  }, [])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return

    const touch = e.touches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    }
    hasTriggeredRef.current = false
    thresholdFeedbackRef.current = false

    setState(prev => ({ ...prev, isSwiping: true }))

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        if (touchStartRef.current && !hasTriggeredRef.current) {
          hapticMedium()
          onLongPress()
          hasTriggeredRef.current = true
          reset()
        }
      }, longPressDuration)
    }
  }, [enabled, onLongPress, longPressDuration, reset])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y

    // If vertical movement exceeds threshold, cancel the swipe
    if (Math.abs(deltaY) > maxVerticalMovement) {
      clearLongPressTimer()
      reset()
      return
    }

    // Clear long press if user is swiping
    if (Math.abs(deltaX) > 10) {
      clearLongPressTimer()
    }

    // Determine direction and apply constraints
    const direction = deltaX < 0 ? 'left' : deltaX > 0 ? 'right' : null

    // Check if this direction is enabled
    if (direction === 'left' && !enableSwipeLeft) {
      reset()
      return
    }
    if (direction === 'right' && !enableSwipeRight) {
      reset()
      return
    }

    // Calculate offset with resistance when going past threshold
    let offsetX = deltaX
    const absOffset = Math.abs(offsetX)

    if (absOffset > threshold) {
      // Apply resistance - slow down movement past threshold
      const excess = absOffset - threshold
      const dampedExcess = excess * 0.3
      offsetX = (deltaX > 0 ? 1 : -1) * (threshold + dampedExcess)
    }

    const thresholdReached = Math.abs(deltaX) >= threshold

    // Haptic feedback when crossing threshold (only once per swipe)
    if (thresholdReached && !thresholdFeedbackRef.current) {
      hapticMedium()
      thresholdFeedbackRef.current = true
    }

    // Prevent vertical scrolling during horizontal swipe
    if (Math.abs(deltaX) > 10) {
      e.preventDefault()
    }

    setState({
      offsetX,
      isSwiping: true,
      direction,
      thresholdReached,
    })
  }, [enabled, maxVerticalMovement, threshold, enableSwipeLeft, enableSwipeRight, clearLongPressTimer, reset])

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer()

    if (!touchStartRef.current || hasTriggeredRef.current) {
      reset()
      return
    }

    const { thresholdReached, direction } = state

    if (thresholdReached && direction) {
      hasTriggeredRef.current = true
      hapticMedium()

      if (direction === 'left' && onSwipeLeft) {
        onSwipeLeft()
      } else if (direction === 'right' && onSwipeRight) {
        onSwipeRight()
      }
    }

    reset()
  }, [state, onSwipeLeft, onSwipeRight, clearLongPressTimer, reset])

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer()
    reset()
  }, [clearLongPressTimer, reset])

  // Check if touch is supported
  const isTouchDevice = useCallback(() => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled || !isTouchDevice()) return

    // Use passive: false to allow preventDefault for horizontal scroll prevention
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchCancel)
      clearLongPressTimer()
    }
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, clearLongPressTimer, isTouchDevice])

  return {
    ref,
    state,
    reset,
  }
}

/**
 * Check if the current device supports touch
 */
export function isTouchSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}
