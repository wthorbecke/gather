/**
 * Hooks Index
 *
 * Central export point for all custom hooks.
 * Import hooks from '@/hooks' instead of individual files.
 */

// Data hooks
export { useTasks, useHabits, useSoulActivities, useZoneTasks } from './useUserData'
export type { Task, Step, Habit, SoulActivity, Subtask, TaskAction, ClarifyingAnswer } from './useUserData'

// Memory hook
export { useMemory } from './useMemory'
export type { MemoryEntry } from './useMemory'

// Context gathering hook
export { useContextGathering } from './useContextGathering'
export type { ContextQuestion, ContextGatheringState, DuplicatePrompt } from './useContextGathering'

// AI card hook
export { useAICard, formatActionLabel, buildCompletionPrompt } from './useAICard'
export type { AICardState, UseAICardOptions } from './useAICard'

// Search hooks
export { useTaskSearch } from './useTaskSearch'
