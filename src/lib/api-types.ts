/**
 * Type definitions for API responses
 * Used to replace explicit `any` types in the codebase
 */

/**
 * Response from /api/analyze-intent
 * Analyzes user input and determines if more context is needed
 */
export interface AnalyzeIntentResponse {
  taskName: string
  taskType?: 'bureaucratic' | 'personal' | 'learning' | 'creative' | 'habit' | 'project' | 'quick' | 'vague'
  understanding?: string
  extractedContext?: Record<string, string>
  deadline?: {
    date: string | null
    type?: 'hard' | 'soft' | 'flexible'
    source?: 'explicit' | 'inferred' | 'none'
    note?: string | null
  }
  needsMoreInfo?: boolean
  reasoning?: string
  questions?: Array<{
    question?: string
    text?: string
    key: string
    options: string[]
    why?: string
  }>
  ifComplete?: {
    steps: AnalyzeIntentStep[]
    contextSummary?: string
  }
  // Error response fields
  error?: string
  rawContent?: string
}

/**
 * Step from analyze-intent response (before being converted to Step)
 */
export interface AnalyzeIntentStep {
  text: string
  summary?: string
  detail?: string
  time?: string
}

/**
 * Rich step item from /api/suggest-subtasks response
 */
export interface SubtaskItem {
  text?: string
  summary?: string
  detail?: string
  alternatives?: string[]
  examples?: string[]
  checklist?: string[]
  time?: string
  source?: { name: string; url: string }
  action?: { text: string; url: string }
}

/**
 * Response from /api/suggest-subtasks
 */
export interface SuggestSubtasksResponse {
  subtasks: Array<SubtaskItem | string>
  sources?: Array<{ title: string; url: string }>
  error?: string
}

/**
 * Action from /api/chat response
 */
export interface ChatAction {
  type: 'mark_step_done' | 'focus_step' | 'create_task' | 'show_sources'
  stepId?: string | number
  title?: string
  context?: string
  label?: string
}

/**
 * Response from /api/chat
 */
export interface ChatResponse {
  response: string
  sources?: Array<{ title: string; url: string }>
  actions?: ChatAction[]
  error?: string
}
