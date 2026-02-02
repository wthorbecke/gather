/**
 * Application Constants
 *
 * Central location for type-safe enums and constants used throughout the app.
 * Using const objects with `as const` for better string literal compatibility.
 */

// Task categories - represents the state/priority of a task
export const TaskCategory = {
  URGENT: 'urgent',
  SOON: 'soon',
  WAITING: 'waiting',
  COMPLETED: 'completed',
} as const

export type TaskCategory = typeof TaskCategory[keyof typeof TaskCategory]

// Active task categories (excludes completed)
export type ActiveTaskCategory = Exclude<TaskCategory, 'completed'>

// Task source - where the task originated from
export const TaskSource = {
  MANUAL: 'manual',
  EMAIL: 'email',
  GMAIL: 'gmail',
  CALENDAR: 'calendar',
} as const

export type TaskSource = typeof TaskSource[keyof typeof TaskSource]

// Check-in types - different kinds of user check-ins
export const CheckinType = {
  MORNING: 'morning',
  EVENING: 'evening',
  ALERT: 'alert',
  CUSTOM: 'custom',
} as const

export type CheckinType = typeof CheckinType[keyof typeof CheckinType]

// Habit categories - groupings for habits
export const HabitCategory = {
  MORNING: 'morning',
  GAMES: 'games',
  OPTIONAL: 'optional',
} as const

export type HabitCategory = typeof HabitCategory[keyof typeof HabitCategory]
