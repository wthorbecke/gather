/**
 * Natural Language Time Parser
 *
 * Parses time expressions from text input for reminders and scheduled tasks.
 * Uses simple regex patterns - could be enhanced with chrono-node for production.
 */

interface ParsedTime {
  date: Date
  text: string  // Original matched text
}

interface ParseResult {
  scheduledAt: Date | null
  cleanText: string
  matchedTimeText: string | null
}

// Time patterns with their parsers
const TIME_PATTERNS: Array<{
  pattern: RegExp
  parse: (match: RegExpMatchArray) => Date | null
}> = [
  // "tomorrow 5pm", "tomorrow at 5pm", "tomorrow 5:30pm"
  {
    pattern: /\btomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    parse: (match) => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return parseTimeIntoDate(tomorrow, match[1], match[2], match[3])
    },
  },
  // "today 5pm", "today at 5pm"
  {
    pattern: /\btoday\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    parse: (match) => {
      const today = new Date()
      return parseTimeIntoDate(today, match[1], match[2], match[3])
    },
  },
  // "at 5pm", "at 5:30pm", "at 17:00"
  {
    pattern: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    parse: (match) => {
      const today = new Date()
      return parseTimeIntoDate(today, match[1], match[2], match[3])
    },
  },
  // "in 2 hours", "in 30 minutes", "in 1 hour"
  {
    pattern: /\bin\s+(\d+)\s+(hour|minute|min|hr)s?\b/i,
    parse: (match) => {
      const amount = parseInt(match[1], 10)
      const unit = match[2].toLowerCase()
      const date = new Date()

      if (unit.startsWith('hour') || unit === 'hr') {
        date.setHours(date.getHours() + amount)
      } else if (unit.startsWith('min')) {
        date.setMinutes(date.getMinutes() + amount)
      }

      return date
    },
  },
  // "next monday", "next tuesday", etc.
  {
    pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    parse: (match) => {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const targetDay = dayNames.indexOf(match[1].toLowerCase())
      if (targetDay === -1) return null

      const date = new Date()
      const currentDay = date.getDay()
      let daysUntil = targetDay - currentDay

      if (daysUntil <= 0) {
        daysUntil += 7
      }

      date.setDate(date.getDate() + daysUntil)
      date.setHours(9, 0, 0, 0) // Default to 9am
      return date
    },
  },
  // "monday 5pm", "tuesday at 3pm"
  {
    pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    parse: (match) => {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const targetDay = dayNames.indexOf(match[1].toLowerCase())
      if (targetDay === -1) return null

      const date = new Date()
      const currentDay = date.getDay()
      let daysUntil = targetDay - currentDay

      if (daysUntil < 0) {
        daysUntil += 7
      } else if (daysUntil === 0) {
        // If today and time already passed, go to next week
        const parsed = parseTimeIntoDate(new Date(), match[2], match[3], match[4])
        if (parsed && parsed < new Date()) {
          daysUntil = 7
        }
      }

      date.setDate(date.getDate() + daysUntil)
      return parseTimeIntoDate(date, match[2], match[3], match[4])
    },
  },
  // Simple time: "5pm", "5:30pm", "17:00"
  {
    pattern: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    parse: (match) => {
      const today = new Date()
      const parsed = parseTimeIntoDate(today, match[1], match[2], match[3])

      // If time already passed today, schedule for tomorrow
      if (parsed && parsed < new Date()) {
        parsed.setDate(parsed.getDate() + 1)
      }

      return parsed
    },
  },
]

/**
 * Parse hour, minute, and am/pm into a Date object
 */
function parseTimeIntoDate(
  baseDate: Date,
  hourStr: string,
  minuteStr: string | undefined,
  ampm: string | undefined
): Date | null {
  let hour = parseInt(hourStr, 10)
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0

  if (isNaN(hour) || hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  // Handle am/pm
  if (ampm) {
    const isPM = ampm.toLowerCase() === 'pm'
    if (hour === 12) {
      hour = isPM ? 12 : 0
    } else if (isPM) {
      hour += 12
    }
  } else if (hour < 12 && hour !== 0) {
    // No am/pm specified, assume PM for business hours (6-11)
    if (hour >= 1 && hour <= 6) {
      hour += 12
    }
  }

  const result = new Date(baseDate)
  result.setHours(hour, minute, 0, 0)
  return result
}

/**
 * Parse natural language time from text
 * Returns the scheduled date and the text with time removed
 */
export function parseTime(text: string): ParseResult {
  for (const { pattern, parse } of TIME_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const date = parse(match)
      if (date) {
        // Remove the matched time from the text
        const cleanText = text.replace(match[0], '').replace(/\s+/g, ' ').trim()
        return {
          scheduledAt: date,
          cleanText,
          matchedTimeText: match[0],
        }
      }
    }
  }

  return {
    scheduledAt: null,
    cleanText: text,
    matchedTimeText: null,
  }
}

/**
 * Format a date for display in the input preview
 */
export function formatPreviewTime(date: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (isToday) {
    return `Today ${timeStr}`
  }

  if (isTomorrow) {
    return `Tomorrow ${timeStr}`
  }

  const dayStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return `${dayStr} ${timeStr}`
}

/**
 * Parse input text for type prefix and time
 * Combined utility for the input component
 */
export function parseQuickInput(text: string): {
  type: 'task' | 'reminder' | 'habit' | 'event'
  title: string
  scheduledAt: Date | null
  previewText: string | null
} {
  // Import here to avoid circular dependency
  const { parseTypePrefix } = require('./taskTypes')

  // First, detect type prefix
  const { type, cleanText } = parseTypePrefix(text)

  // For reminders, also try to parse time
  if (type === 'reminder') {
    const { scheduledAt, cleanText: titleText, matchedTimeText } = parseTime(cleanText)
    return {
      type,
      title: titleText,
      scheduledAt,
      previewText: scheduledAt ? formatPreviewTime(scheduledAt) : null,
    }
  }

  // For events, try to parse time
  if (type === 'event') {
    const { scheduledAt, cleanText: titleText } = parseTime(cleanText)
    return {
      type,
      title: titleText,
      scheduledAt,
      previewText: scheduledAt ? formatPreviewTime(scheduledAt) : null,
    }
  }

  return {
    type,
    title: cleanText,
    scheduledAt: null,
    previewText: null,
  }
}
