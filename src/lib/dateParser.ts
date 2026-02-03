/**
 * Natural language date parser
 * Extracts dates from user input like "tomorrow", "next Friday", "March 15", etc.
 */

interface ParsedDate {
  date: Date
  matchedText: string
  startIndex: number
  endIndex: number
}

/**
 * Parse natural language dates from text
 * Returns the extracted date and the remaining text without the date portion
 */
export function parseNaturalDate(text: string): { date: Date | null; cleanedText: string; matchedText: string | null } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Patterns to match, in order of specificity (most specific first)
  const patterns: { regex: RegExp; getDate: (match: RegExpMatchArray) => Date }[] = [
    // "by/on/due March 15" or "by/on/due March 15th" or "by/on/due Mar 15"
    {
      regex: /\b(?:by|on|due|before)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      getDate: (match) => {
        const monthStr = match[1].toLowerCase()
        const day = parseInt(match[2])
        const monthIndex = getMonthIndex(monthStr)
        let year = now.getFullYear()
        const date = new Date(year, monthIndex, day)
        // If date is in the past, assume next year
        if (date < today) {
          date.setFullYear(year + 1)
        }
        return date
      }
    },
    // "March 15" without preposition
    {
      regex: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      getDate: (match) => {
        const monthStr = match[1].toLowerCase()
        const day = parseInt(match[2])
        const monthIndex = getMonthIndex(monthStr)
        let year = now.getFullYear()
        const date = new Date(year, monthIndex, day)
        // If date is in the past, assume next year
        if (date < today) {
          date.setFullYear(year + 1)
        }
        return date
      }
    },
    // "by/on/due next Monday/Tuesday/etc"
    {
      regex: /\b(?:by|on|due|before)\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      getDate: (match) => {
        const dayName = match[1].toLowerCase()
        const targetDay = getDayIndex(dayName)
        const date = new Date(today)
        const currentDay = date.getDay()
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        daysToAdd += 7 // "next" means the one after this week
        date.setDate(date.getDate() + daysToAdd)
        return date
      }
    },
    // "next Monday/Tuesday/etc" without preposition
    {
      regex: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      getDate: (match) => {
        const dayName = match[1].toLowerCase()
        const targetDay = getDayIndex(dayName)
        const date = new Date(today)
        const currentDay = date.getDay()
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        daysToAdd += 7 // "next" means the one after this week
        date.setDate(date.getDate() + daysToAdd)
        return date
      }
    },
    // "by/on/due this Monday/Tuesday/etc"
    {
      regex: /\b(?:by|on|due|before)\s+this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      getDate: (match) => {
        const dayName = match[1].toLowerCase()
        const targetDay = getDayIndex(dayName)
        const date = new Date(today)
        const currentDay = date.getDay()
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        date.setDate(date.getDate() + daysToAdd)
        return date
      }
    },
    // "this Monday/Tuesday/etc" without preposition
    {
      regex: /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|saturday|sunday)\b/i,
      getDate: (match) => {
        const dayName = match[1].toLowerCase()
        const targetDay = getDayIndex(dayName)
        const date = new Date(today)
        const currentDay = date.getDay()
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        date.setDate(date.getDate() + daysToAdd)
        return date
      }
    },
    // "by/on/due Monday/Tuesday/etc" (assumes this or next occurrence)
    {
      regex: /\b(?:by|on|due|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      getDate: (match) => {
        const dayName = match[1].toLowerCase()
        const targetDay = getDayIndex(dayName)
        const date = new Date(today)
        const currentDay = date.getDay()
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        date.setDate(date.getDate() + daysToAdd)
        return date
      }
    },
    // "by/on/due tomorrow"
    {
      regex: /\b(?:by|on|due|before)\s+tomorrow\b/i,
      getDate: () => {
        const date = new Date(today)
        date.setDate(date.getDate() + 1)
        return date
      }
    },
    // "tomorrow" without preposition
    {
      regex: /\btomorrow\b/i,
      getDate: () => {
        const date = new Date(today)
        date.setDate(date.getDate() + 1)
        return date
      }
    },
    // "by/on/due today"
    {
      regex: /\b(?:by|on|due|before)\s+today\b/i,
      getDate: () => new Date(today)
    },
    // "today" without preposition
    {
      regex: /\btoday\b/i,
      getDate: () => new Date(today)
    },
    // "in X days/weeks"
    {
      regex: /\bin\s+(\d+)\s+(day|days|week|weeks)\b/i,
      getDate: (match) => {
        const amount = parseInt(match[1])
        const unit = match[2].toLowerCase()
        const date = new Date(today)
        if (unit.startsWith('day')) {
          date.setDate(date.getDate() + amount)
        } else {
          date.setDate(date.getDate() + amount * 7)
        }
        return date
      }
    },
    // "next week"
    {
      regex: /\bnext\s+week\b/i,
      getDate: () => {
        const date = new Date(today)
        date.setDate(date.getDate() + 7)
        return date
      }
    },
    // "end of week" / "end of the week"
    {
      regex: /\bend\s+of\s+(?:the\s+)?week\b/i,
      getDate: () => {
        const date = new Date(today)
        const daysUntilFriday = (5 - date.getDay() + 7) % 7 || 7
        date.setDate(date.getDate() + daysUntilFriday)
        return date
      }
    },
    // "end of month" / "end of the month"
    {
      regex: /\bend\s+of\s+(?:the\s+)?month\b/i,
      getDate: () => {
        const date = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        return date
      }
    },
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern.regex)
    if (match) {
      const date = pattern.getDate(match)
      const matchedText = match[0]
      // Remove the matched date text and clean up
      const cleanedText = text
        .replace(match[0], '')
        .replace(/\s+/g, ' ')
        .trim()

      return { date, cleanedText, matchedText }
    }
  }

  return { date: null, cleanedText: text, matchedText: null }
}

/**
 * Get month index (0-11) from month name
 */
function getMonthIndex(monthStr: string): number {
  const months: { [key: string]: number } = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }
  return months[monthStr.toLowerCase()] ?? 0
}

/**
 * Get day index (0-6, Sunday=0) from day name
 */
function getDayIndex(dayName: string): number {
  const days: { [key: string]: number } = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }
  return days[dayName.toLowerCase()] ?? 0
}

/**
 * Format a date for display
 */
export function formatParsedDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  }

  // Calculate days difference
  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}
