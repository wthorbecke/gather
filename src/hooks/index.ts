/**
 * Hooks Index
 *
 * Central export point for all custom hooks.
 * Import hooks from '@/hooks' instead of individual files.
 */

// Data hooks
export { useTasks } from './useUserData'
export type { Task, Step, Subtask, TaskAction, ClarifyingAnswer } from './useUserData'

// Memory hook
export { useMemory } from './useMemory'
export type { MemoryEntry } from './useMemory'

// Context gathering hook
export { useContextGathering } from './useContextGathering'
export type { ContextQuestion, ContextGatheringState } from './useContextGathering'

// Duplicate detection hook
export { useDuplicateDetection } from './useDuplicateDetection'
export type { DuplicatePrompt, DuplicateDetectionReturn } from './useDuplicateDetection'

// AI card hook
export { useAICard, formatActionLabel, buildCompletionPrompt } from './useAICard'
export type { AICardState, UseAICardOptions } from './useAICard'

// AI card state hook (extracted from useAIConversation)
export { useAICardState } from './useAICardState'
export type { AICardStateReturn } from './useAICardState'

// Search hooks
export { useTaskSearch } from './useTaskSearch'

// Conversation history hook
export { useConversationHistory } from './useConversationHistory'
export type { ConversationMessage, ConversationHistoryReturn } from './useConversationHistory'

// Undo hook
export { useUndo } from './useUndo'
export type { UndoAction, UndoActionType, UseUndoReturn } from './useUndo'

// Subscription hook
export { useSubscription } from './useSubscription'
export type { Subscription, SubscriptionStatus } from './useSubscription'

// Swipe gesture hook
export { useSwipeGesture, isTouchSupported } from './useSwipeGesture'
export type { SwipeGestureOptions, SwipeState, SwipeGestureReturn } from './useSwipeGesture'
