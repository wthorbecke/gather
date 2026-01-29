/**
 * Haptic feedback utilities for mobile devices
 * Uses the Vibration API when available
 */

/**
 * Trigger a light haptic tap (for checkbox completions, button presses)
 */
export function hapticLight(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

/**
 * Trigger a medium haptic tap (for task completions)
 */
export function hapticMedium(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(20)
  }
}

/**
 * Trigger a success haptic pattern (for completing all steps)
 */
export function hapticSuccess(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    // Double tap pattern
    navigator.vibrate([15, 50, 15])
  }
}
