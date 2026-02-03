/**
 * Haptic feedback utilities for mobile devices
 * Uses the Vibration API when available
 */

const STORAGE_KEY = 'gather_haptics_enabled'

/**
 * Check if haptic feedback should be triggered
 * Returns false if:
 * - Vibration API is not supported
 * - User has disabled haptics in preferences
 * - User prefers reduced motion
 */
function shouldVibrate(): boolean {
  // Check if vibration is supported
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return false
  }

  // Check user preference (default to enabled)
  if (typeof localStorage !== 'undefined') {
    const hapticsEnabled = localStorage.getItem(STORAGE_KEY)
    if (hapticsEnabled === 'false') {
      return false
    }
  }

  // Check for reduced motion preference
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false
  }

  return true
}

/**
 * Trigger a light haptic tap (for checkbox completions, button presses)
 */
export function hapticLight(): void {
  if (shouldVibrate()) {
    try {
      navigator.vibrate(10)
    } catch {
      // Silently fail - vibration might be blocked
    }
  }
}

/**
 * Trigger a medium haptic tap (for significant actions)
 */
export function hapticMedium(): void {
  if (shouldVibrate()) {
    try {
      navigator.vibrate(20)
    } catch {
      // Silently fail - vibration might be blocked
    }
  }
}

/**
 * Trigger a heavy haptic tap (for level ups, major achievements)
 */
export function hapticHeavy(): void {
  if (shouldVibrate()) {
    try {
      navigator.vibrate(40)
    } catch {
      // Silently fail - vibration might be blocked
    }
  }
}

/**
 * Trigger a success haptic pattern (for completing all steps / task completion)
 * Double tap pattern that feels celebratory
 */
export function hapticSuccess(): void {
  if (shouldVibrate()) {
    try {
      navigator.vibrate([10, 50, 20])
    } catch {
      // Silently fail - vibration might be blocked
    }
  }
}

/**
 * Trigger a warning haptic pattern (for alerts, errors)
 * Triple pulse pattern
 */
export function hapticWarning(): void {
  if (shouldVibrate()) {
    try {
      navigator.vibrate([30, 30, 30])
    } catch {
      // Silently fail - vibration might be blocked
    }
  }
}

// Convenience aliases for specific actions
export const hapticStepComplete = hapticLight
export const hapticTaskComplete = hapticSuccess
export const hapticLevelUp = hapticHeavy

/**
 * Enable or disable haptic feedback
 */
export function setHapticsEnabled(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  }
}

/**
 * Check if haptics are enabled in user preferences
 * Note: Returns true by default if preference is not set
 */
export function areHapticsEnabled(): boolean {
  if (typeof localStorage === 'undefined') {
    return true
  }
  return localStorage.getItem(STORAGE_KEY) !== 'false'
}
