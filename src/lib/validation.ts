/**
 * Input validation utilities for API routes
 *
 * Protects against:
 * - DoS via massive inputs
 * - Basic prompt injection patterns
 * - Malformed data
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

// Maximum lengths for different input types
export const MAX_LENGTHS = {
  /** Task title */
  taskTitle: 500,
  /** Task description/notes */
  taskDescription: 5000,
  /** Chat message */
  chatMessage: 2000,
  /** Context object (stringified) */
  context: 10000,
  /** Single step text */
  stepText: 1000,
  /** Generic short text */
  shortText: 200,
} as const

/**
 * Validate a string input
 */
export function validateString(
  value: unknown,
  maxLength: number,
  fieldName: string
): ValidationResult {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${fieldName} must be a string`,
    }
  }

  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} too long (max ${maxLength} characters)`,
    }
  }

  return { valid: true }
}

/**
 * Validate chat message input
 */
export function validateChatInput(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' }
  }

  const { message, context, history } = body as Record<string, unknown>

  // Validate message
  const messageCheck = validateString(message, MAX_LENGTHS.chatMessage, 'message')
  if (!messageCheck.valid) return messageCheck

  // Validate context if present
  if (context !== undefined && context !== null) {
    const contextStr = typeof context === 'string' ? context : JSON.stringify(context)
    if (contextStr.length > MAX_LENGTHS.context) {
      return { valid: false, error: 'Context too large' }
    }
  }

  // Validate history array
  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return { valid: false, error: 'History must be an array' }
    }
    if (history.length > 50) {
      return { valid: false, error: 'History too long (max 50 messages)' }
    }
    // Validate each history entry
    for (const entry of history) {
      if (typeof entry !== 'object' || !entry) {
        return { valid: false, error: 'Invalid history entry' }
      }
      const { role, content } = entry as Record<string, unknown>
      if (typeof role !== 'string' || !['user', 'assistant'].includes(role)) {
        return { valid: false, error: 'Invalid history role' }
      }
      if (typeof content !== 'string' || content.length > MAX_LENGTHS.chatMessage) {
        return { valid: false, error: 'Invalid history content' }
      }
    }
  }

  return { valid: true }
}

/**
 * Validate task breakdown input
 */
export function validateTaskInput(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' }
  }

  const { title, description, notes } = body as Record<string, unknown>

  // Title is required
  if (!title) {
    return { valid: false, error: 'Title is required' }
  }

  const titleCheck = validateString(title, MAX_LENGTHS.taskTitle, 'title')
  if (!titleCheck.valid) return titleCheck

  // Optional fields
  if (description !== undefined && description !== null) {
    const descCheck = validateString(description, MAX_LENGTHS.taskDescription, 'description')
    if (!descCheck.valid) return descCheck
  }

  if (notes !== undefined && notes !== null) {
    const notesCheck = validateString(notes, MAX_LENGTHS.taskDescription, 'notes')
    if (!notesCheck.valid) return notesCheck
  }

  return { valid: true }
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(result: ValidationResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      message: result.error,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
