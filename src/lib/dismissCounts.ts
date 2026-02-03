/**
 * Dismiss Counts Utility
 *
 * Tracks how many times a card has been dismissed in the Stack view.
 * Used to deprioritize repeatedly skipped items.
 */

import { safeGetJSON, safeSetJSON } from './storage'

export const DISMISS_COUNTS_KEY = 'gather-dismiss-counts'

/**
 * Get all dismiss counts from storage
 */
export function getDismissCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  return safeGetJSON<Record<string, number>>(DISMISS_COUNTS_KEY, {})
}

/**
 * Increment dismiss count for an item and return the new count
 */
export function incrementDismissCount(id: string): number {
  const counts = getDismissCounts()
  counts[id] = (counts[id] || 0) + 1
  safeSetJSON(DISMISS_COUNTS_KEY, counts)
  return counts[id]
}

/**
 * Clear dismiss count for an item (e.g., when completed)
 */
export function clearDismissCount(id: string): void {
  const counts = getDismissCounts()
  delete counts[id]
  safeSetJSON(DISMISS_COUNTS_KEY, counts)
}
