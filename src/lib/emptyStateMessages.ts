/**
 * Contextual, time-aware empty state messages for Gather
 *
 * Messages are:
 * - Brief (1 sentence)
 * - Warm but not over-the-top
 * - Never guilt-tripping
 * - Time and day aware
 */

export type EmptyStateContext =
  | 'home'           // HomeView - no tasks at all
  | 'homeAllDone'    // HomeView - all tasks completed
  | 'stack'          // StackView - empty stack
  | 'stackCelebrate' // StackView - just cleared everything
  | 'day'            // DayView - nothing scheduled

export interface EmptyStateMessage {
  symbol: string
  title: string
  subtitle: string
}

// Get time of day
function getHour(): number {
  return new Date().getHours()
}

// Get day of week (0 = Sunday)
function getDayOfWeek(): number {
  return new Date().getDay()
}

// Pick a random item from an array (with some variety)
function pickRandom<T>(items: T[]): T {
  // Use minute-based seed for some variety but not too much churn
  const seed = Math.floor(Date.now() / 60000) % items.length
  return items[seed]
}

/**
 * Time-aware messages for when there are no tasks
 */
function getNoTasksMessage(): EmptyStateMessage {
  const hour = getHour()
  const day = getDayOfWeek()

  // Day-specific messages take priority on certain days
  if (day === 5) { // Friday
    return {
      symbol: '○',
      title: 'All clear',
      subtitle: "Friday's looking good. Weekend ahead.",
    }
  }
  if (day === 0 || day === 6) { // Weekend
    return {
      symbol: '○',
      title: 'Clear slate',
      subtitle: 'Weekend vibes. All yours.',
    }
  }
  if (day === 1) { // Monday
    return {
      symbol: '○',
      title: 'Fresh start',
      subtitle: "Monday's sorted. What's first?",
    }
  }

  // Time-based messages
  if (hour < 6) {
    return {
      symbol: '○',
      title: 'Still',
      subtitle: "Up early? Everything's clear. Rest if you can.",
    }
  }
  if (hour < 12) {
    return {
      symbol: '○',
      title: 'Clear',
      subtitle: 'Nothing on your plate this morning. Fresh start.',
    }
  }
  if (hour < 14) {
    return {
      symbol: '○',
      title: 'Open',
      subtitle: 'All clear for now. Maybe grab some lunch?',
    }
  }
  if (hour < 17) {
    return {
      symbol: '○',
      title: 'Clear',
      subtitle: "Afternoon's looking good. You're ahead.",
    }
  }
  if (hour < 21) {
    return {
      symbol: '○',
      title: 'Quiet',
      subtitle: "Evening's free. You've earned a break.",
    }
  }
  return {
    symbol: '○',
    title: 'Still',
    subtitle: 'Nothing left tonight. Rest up.',
  }
}

/**
 * Messages for when all tasks are completed
 */
function getAllDoneMessage(): EmptyStateMessage {
  const hour = getHour()
  const day = getDayOfWeek()

  // Completion messages with subtle variety
  const completionMessages: EmptyStateMessage[] = [
    { symbol: '✓', title: 'All done', subtitle: 'Take a breath.' },
    { symbol: '✓', title: 'Clean slate', subtitle: 'Nice work.' },
    { symbol: '✓', title: 'Cleared', subtitle: 'You crushed it.' },
    { symbol: '✓', title: 'All caught up', subtitle: 'What now is up to you.' },
  ]

  // Friday celebration
  if (day === 5 && hour >= 16) {
    return {
      symbol: '✓',
      title: 'Cleared',
      subtitle: "Friday done. Weekend's yours.",
    }
  }

  // Weekend completion
  if (day === 0 || day === 6) {
    return {
      symbol: '✓',
      title: 'All caught up',
      subtitle: 'Weekend well spent.',
    }
  }

  // Time-based completion messages
  if (hour < 6) {
    return {
      symbol: '✓',
      title: 'All done',
      subtitle: 'Rest well.',
    }
  }
  if (hour < 12) {
    return {
      symbol: '✓',
      title: 'All caught up',
      subtitle: 'Great start to the day.',
    }
  }
  if (hour < 17) {
    return {
      symbol: '✓',
      title: 'Cleared',
      subtitle: 'Cruising. Nice momentum.',
    }
  }
  if (hour < 21) {
    return {
      symbol: '✓',
      title: 'Done for the day',
      subtitle: 'You earned this evening.',
    }
  }

  // Late night - pick from general completion messages
  return pickRandom(completionMessages)
}

/**
 * Stack view empty state - inviting, time-appropriate
 */
function getStackEmptyMessage(celebrating: boolean): EmptyStateMessage {
  const hour = getHour()

  if (celebrating) {
    // Just cleared everything - brief acknowledgment
    if (hour < 6) return { symbol: '✓', title: 'done', subtitle: 'rest well' }
    if (hour < 12) return { symbol: '✓', title: 'cleared', subtitle: 'good start to the day' }
    if (hour < 17) return { symbol: '✓', title: 'all done', subtitle: 'nice momentum' }
    if (hour < 21) return { symbol: '✓', title: 'cleared', subtitle: 'you earned this evening' }
    return { symbol: '✓', title: 'done', subtitle: 'rest well' }
  }

  // Default empty state - inviting, time-appropriate
  if (hour < 6) return { symbol: '○', title: 'still', subtitle: 'here when you need' }
  if (hour < 9) return { symbol: '○', title: 'ready', subtitle: "what's on your mind?" }
  if (hour < 12) return { symbol: '○', title: 'clear', subtitle: 'nothing waiting' }
  if (hour < 17) return { symbol: '○', title: 'open', subtitle: 'add something whenever' }
  if (hour < 21) return { symbol: '○', title: 'quiet', subtitle: 'nothing pressing' }
  return { symbol: '○', title: 'still', subtitle: 'here when you need' }
}

/**
 * Day view empty state - calendar-focused
 */
function getDayEmptyMessage(isToday: boolean): EmptyStateMessage {
  const hour = getHour()
  const day = getDayOfWeek()

  if (!isToday) {
    return {
      symbol: '○',
      title: 'Nothing planned',
      subtitle: 'Schedule something or leave it open.',
    }
  }

  // Weekend
  if (day === 0 || day === 6) {
    return {
      symbol: '○',
      title: 'Nothing scheduled',
      subtitle: 'Keep it chill or plan something fun.',
    }
  }

  // Time-based for today
  if (hour < 9) {
    return {
      symbol: '○',
      title: 'Day ahead',
      subtitle: 'Nothing scheduled yet. Fresh canvas.',
    }
  }
  if (hour < 12) {
    return {
      symbol: '○',
      title: 'Morning clear',
      subtitle: 'No plans. Go with the flow.',
    }
  }
  if (hour < 17) {
    return {
      symbol: '○',
      title: 'Afternoon open',
      subtitle: "Nothing on the books. That's okay.",
    }
  }
  if (hour < 21) {
    return {
      symbol: '○',
      title: 'Evening free',
      subtitle: 'Unscheduled time. Enjoy it.',
    }
  }
  return {
    symbol: '○',
    title: 'Night clear',
    subtitle: 'Rest up.',
  }
}

/**
 * Main function to get contextual empty state message
 */
export function getEmptyStateMessage(
  context: EmptyStateContext,
  options?: { isToday?: boolean }
): EmptyStateMessage {
  switch (context) {
    case 'home':
      return getNoTasksMessage()
    case 'homeAllDone':
      return getAllDoneMessage()
    case 'stack':
      return getStackEmptyMessage(false)
    case 'stackCelebrate':
      return getStackEmptyMessage(true)
    case 'day':
      return getDayEmptyMessage(options?.isToday ?? true)
    default:
      return {
        symbol: '○',
        title: 'Clear',
        subtitle: 'Here when you need.',
      }
  }
}
