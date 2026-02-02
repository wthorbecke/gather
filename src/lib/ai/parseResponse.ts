/**
 * AI Response Parsing Utilities
 *
 * Consolidated utilities for parsing AI responses that may contain JSON.
 * Handles:
 * - Complete JSON responses: {"message":"...", "actions":[...]}
 * - Partial/streaming JSON during response streaming
 * - Escape sequence handling (\\n, \\", \\t, \\\\)
 * - Fallback to raw text when JSON parsing fails
 *
 * Usage:
 *   import { parseAIMessage, parseStreamingMessage } from '@/lib/ai/parseResponse'
 *
 *   // For complete responses:
 *   const message = parseAIMessage(aiResponseText)
 *
 *   // For streaming partial responses:
 *   const partialMessage = parseStreamingMessage(streamedText)
 */

export interface ParsedAIResponse {
  message: string
  actions: Array<{
    type: string
    stepId?: string | number
    title?: string
    context?: string
    label?: string
  }>
  raw: string
}

/**
 * Parse a complete AI response to extract the message and actions.
 *
 * The AI may return responses in several formats:
 * 1. Raw JSON: {"message":"...", "actions":[...]}
 * 2. Plain text
 * 3. Mixed content with JSON embedded
 *
 * @param text - The raw AI response text
 * @returns The extracted message string (falls back to raw text if parsing fails)
 */
export function parseAIMessage(text: string): string {
  if (!text) return ''

  const trimmed = text.trim()

  // Try to parse as JSON and extract message field
  if (trimmed.startsWith('{') && trimmed.includes('"message"')) {
    // First attempt: full JSON parse
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed.message === 'string') {
        return parsed.message
      }
    } catch {
      // JSON parse failed - try regex extraction for malformed JSON
    }

    // Second attempt: regex extraction for partial/malformed JSON
    // Pattern matches "message": "value" with proper escape handling
    // Uses [\s\S]* to match any character including newlines in the value
    const match = trimmed.match(/"message"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"/)
    if (match) {
      return unescapeJsonString(match[1])
    }
  }

  return trimmed
}

/**
 * Parse a complete AI response to extract message, actions, and keep raw text.
 *
 * @param text - The raw AI response text
 * @returns Parsed response with message, actions array, and raw text
 */
export function parseAIResponseFull(text: string): ParsedAIResponse {
  if (!text) {
    return { message: '', actions: [], raw: '' }
  }

  const trimmed = text.trim()
  const result: ParsedAIResponse = {
    message: trimmed,
    actions: [],
    raw: trimmed,
  }

  // Try to find and parse JSON object in the response
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (typeof parsed.message === 'string') {
        result.message = parsed.message
      }
      if (Array.isArray(parsed.actions)) {
        result.actions = parsed.actions
      }
    } catch {
      // JSON parse failed - try extracting just the message
      const messageMatch = trimmed.match(/"message"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"/)
      if (messageMatch) {
        result.message = unescapeJsonString(messageMatch[1])
      }
    }
  }

  return result
}

/**
 * Parse a partial/streaming AI response to extract the message as it streams.
 *
 * During streaming, we may receive incomplete JSON like:
 *   {"message":"Working on it...
 *
 * This function extracts whatever message content is available so far.
 *
 * @param text - The partial streamed text
 * @returns The extracted partial message (or trimmed text if not JSON)
 */
export function parseStreamingMessage(text: string): string {
  if (!text) return ''

  const trimmed = text.trim()

  // If it looks like JSON is starting, try to extract the message value
  if (trimmed.startsWith('{') && trimmed.includes('"message"')) {
    // Find where the message value starts
    const messageStart = trimmed.indexOf('"message"')
    if (messageStart === -1) return ''

    // Find the colon after "message"
    const colonIdx = trimmed.indexOf(':', messageStart)
    if (colonIdx === -1) return ''

    // Find the opening quote of the value
    let valueStart = trimmed.indexOf('"', colonIdx + 1)
    if (valueStart === -1) return ''
    valueStart++ // Move past the opening quote

    // Extract everything after the opening quote, handling escape sequences
    let result = ''
    let i = valueStart
    while (i < trimmed.length) {
      const char = trimmed[i]

      if (char === '\\' && i + 1 < trimmed.length) {
        // Escape sequence - handle common ones
        const next = trimmed[i + 1]
        switch (next) {
          case '"':
            result += '"'
            break
          case 'n':
            result += '\n'
            break
          case 't':
            result += '\t'
            break
          case 'r':
            result += '\r'
            break
          case '\\':
            result += '\\'
            break
          default:
            result += next
        }
        i += 2
      } else if (char === '"') {
        // End of string value - but during streaming we might not have the closing quote
        break
      } else {
        result += char
        i++
      }
    }

    return result
  }

  // Not JSON-like, return the trimmed text
  return trimmed
}

/**
 * Unescape a JSON string value.
 *
 * Handles standard JSON escape sequences:
 * - \\ -> backslash (must be processed first)
 * - \" -> "
 * - \n -> newline
 * - \t -> tab
 * - \r -> carriage return
 *
 * @param str - The escaped string (content between quotes in JSON)
 * @returns The unescaped string
 */
export function unescapeJsonString(str: string): string {
  if (!str) return ''

  // Important: process \\\\ first, otherwise \\n becomes \<newline> instead of \n
  return str
    .replace(/\\\\/g, '\u0000') // Temporarily replace \\ with null char
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\u0000/g, '\\') // Restore backslashes
}

/**
 * Strip cite tags from message content.
 *
 * AI responses may include <cite> tags for source attribution which
 * should not be displayed to users.
 *
 * @param text - The message text potentially containing cite tags
 * @returns The message with cite tags removed
 */
export function stripCiteTags(text: string): string {
  if (!text) return ''
  return text.replace(/<cite[^>]*>.*?<\/cite>/g, '').trim()
}

/**
 * Clean an AI message for display.
 *
 * Combines parsing, unescaping, and tag stripping into a single function
 * for convenience when you just need clean display text.
 *
 * @param text - The raw AI response text
 * @returns Clean message text ready for display
 */
export function cleanAIMessage(text: string): string {
  const message = parseAIMessage(text)
  return stripCiteTags(message)
}
