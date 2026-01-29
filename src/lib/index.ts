/**
 * Library Index
 *
 * Central export point for all utility functions.
 * Import utilities from '@/lib' instead of individual files.
 */

// Supabase client
export { supabase, createServerClient } from './supabase'

// Task helpers
export {
  isQuestion,
  isStepRequest,
  filterActions,
  sanitizeQuestions,
  normalizeForMatch,
  findDuplicateTask,
  buildTaskContext,
  detectCompletionIntent,
  findMatchingStep,
  createStepFromAIResponse,
  createFallbackSteps,
  COMPLETION_KEYWORD_MAP,
  COMPLETION_SIGNALS,
  NEGATION_PATTERNS,
} from './taskHelpers'

// Source quality
export {
  prioritizeSources,
  scoreSource,
  isLowQualitySource,
  isNewsSource,
  hasAuthoritativeSources,
} from './sourceQuality'

// Step text utilities
export { splitStepText } from './stepText'

// Auth utilities
export { signInWithGoogle, signOut, getSession, getUser } from './auth'

// Rate limiting
export {
  checkRateLimit,
  getRequestIdentifier,
  rateLimitResponse,
  RATE_LIMITS,
} from './rateLimit'

// Input validation
export {
  validateString,
  validateChatInput,
  validateTaskInput,
  validationErrorResponse,
  MAX_LENGTHS,
} from './validation'
