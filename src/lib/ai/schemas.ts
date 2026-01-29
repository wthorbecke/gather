/**
 * Zod Schemas for AI Responses
 *
 * Strict validation for every AI response type.
 * Includes fallback defaults for graceful degradation.
 */

import { z } from 'zod'

// ============================================================================
// CHAT RESPONSE
// ============================================================================

export const ChatActionSchema = z.object({
  type: z.enum(['mark_step_done', 'focus_step', 'create_task', 'show_sources']),
  stepId: z.string().optional(),
  title: z.string().optional(),
  context: z.string().optional(),
  label: z.string(),
})

export const ChatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(ChatActionSchema).default([]),
})

export type ChatResponse = z.infer<typeof ChatResponseSchema>
export type ChatAction = z.infer<typeof ChatActionSchema>

export const DEFAULT_CHAT_RESPONSE: ChatResponse = {
  message: "I couldn't process that. Could you try rephrasing?",
  actions: [],
}

// ============================================================================
// TASK BREAKDOWN / SUBTASKS
// ============================================================================

export const StepSourceSchema = z.object({
  name: z.string(),
  url: z.string().url(),
})

export const StepActionSchema = z.object({
  text: z.string(),
  url: z.string(),
})

export const RichStepSchema = z.object({
  text: z.string(),
  summary: z.string().optional(),
  detail: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  checklist: z.array(z.string()).optional(),
  time: z.string().optional(),
  source: StepSourceSchema.optional(),
  action: StepActionSchema.optional(),
})

export const TaskBreakdownResponseSchema = z.array(RichStepSchema)

export type RichStep = z.infer<typeof RichStepSchema>
export type StepSource = z.infer<typeof StepSourceSchema>
export type StepAction = z.infer<typeof StepActionSchema>

export function getDefaultSteps(title: string): RichStep[] {
  const taskLower = title.toLowerCase()

  if (taskLower.includes('cancel')) {
    return [
      { text: `Find contact info for cancellation`, summary: 'Locate cancellation method', time: '5 min' },
      { text: 'Call or use online chat - say "I want to cancel my account"', summary: 'Direct request works best', time: '10 min' },
      { text: 'Get confirmation number or email and save it', summary: 'Proof of cancellation', time: '2 min' },
    ]
  }

  if (taskLower.includes('learn') || taskLower.includes('practice') || taskLower.includes('study')) {
    return [
      { text: 'Decide on one specific skill to focus on this week', summary: 'Narrow focus = faster progress', time: '5 min' },
      { text: 'Do 20 minutes of deliberate practice', summary: 'Quality over quantity', time: '20 min' },
      { text: 'Note what felt hard and what clicked', summary: 'Builds self-awareness', time: '5 min' },
    ]
  }

  if (taskLower.includes('write') || taskLower.includes('draft') || taskLower.includes('create')) {
    return [
      { text: 'Write down 5 bullet points of what you want to say', summary: 'Raw material first', time: '10 min' },
      { text: 'Turn 2-3 bullets into full sentences', summary: 'Just get words down', time: '15 min' },
      { text: 'Read it out loud and fix anything that sounds weird', summary: 'Your ear catches what eyes miss', time: '10 min' },
    ]
  }

  if (taskLower.includes('appointment') || taskLower.includes('schedule') || taskLower.includes('book')) {
    return [
      { text: `Search for online booking or phone number`, summary: 'Find booking method', time: '5 min' },
      { text: 'Check your calendar for 2-3 possible times', summary: 'Be ready with options', time: '3 min' },
      { text: 'Book and add to your calendar immediately', summary: 'Lock it in', time: '5 min' },
    ]
  }

  if (taskLower.includes('email') || taskLower.includes('message') || taskLower.includes('contact')) {
    return [
      { text: 'Write the main point in one sentence', summary: 'Clarity first', time: '3 min' },
      { text: 'Add any necessary context (keep it short)', summary: 'Respect their time', time: '5 min' },
      { text: 'Read once, fix obvious issues, then send', summary: 'Done beats perfect', time: '3 min' },
    ]
  }

  // Generic fallback
  return [
    { text: `Search for how to do "${title}"`, summary: 'Find the actual process', time: '5 min' },
    { text: 'Write down the 3 main things you need to do', summary: 'Capture the key steps', time: '5 min' },
    { text: 'Do the first thing on your list right now', summary: 'Momentum matters most', time: '15 min' },
  ]
}

// ============================================================================
// INTENT ANALYSIS
// ============================================================================

export const DeadlineSchema = z.object({
  date: z.string().nullable(),
  type: z.enum(['hard', 'soft', 'flexible']),
  source: z.enum(['explicit', 'inferred', 'none']),
  note: z.string().nullable(),
})

export const ClarifyingQuestionSchema = z.object({
  question: z.string(),
  key: z.string(),
  options: z.array(z.string()).optional(),
  why: z.string().optional(),
})

export const IntentStepSchema = z.object({
  text: z.string(),
  summary: z.string().optional(),
  time: z.string().optional(),
})

export const IntentAnalysisResponseSchema = z.object({
  taskName: z.string(),
  taskType: z.enum(['bureaucratic', 'personal', 'learning', 'creative', 'habit', 'project', 'quick', 'vague']),
  understanding: z.string(),
  extractedContext: z.record(z.string(), z.string()).default({}),
  deadline: DeadlineSchema.optional(),
  needsMoreInfo: z.boolean(),
  reasoning: z.string(),
  questions: z.array(ClarifyingQuestionSchema).default([]),
  ifComplete: z.object({
    steps: z.array(IntentStepSchema).default([]),
    contextSummary: z.string().default(''),
  }).optional(),
})

export type IntentAnalysisResponse = z.infer<typeof IntentAnalysisResponseSchema>
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>
export type Deadline = z.infer<typeof DeadlineSchema>

export const DEFAULT_INTENT_RESPONSE: IntentAnalysisResponse = {
  taskName: 'Task',
  taskType: 'quick',
  understanding: 'Processing your request',
  extractedContext: {},
  needsMoreInfo: false,
  reasoning: 'Unable to analyze - proceeding with basic task',
  questions: [],
}

// ============================================================================
// TASK ANALYSIS (Quick Classification)
// ============================================================================

export const TaskAnalysisQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  why: z.string(),
  options: z.array(z.string()).nullable(),
})

export const TaskAnalysisResponseSchema = z.object({
  needsClarification: z.boolean(),
  taskType: z.enum(['bureaucratic', 'learning', 'creative', 'habit', 'multi_phase', 'vague_goal', 'other']),
  taskCategory: z.enum(['government', 'medical', 'financial', 'travel', 'home', 'work', 'errand', 'personal', 'other']),
  questions: z.array(TaskAnalysisQuestionSchema).default([]),
  deadline: DeadlineSchema.optional(),
  immediateInsight: z.string().nullable(),
})

export type TaskAnalysisResponse = z.infer<typeof TaskAnalysisResponseSchema>

export const DEFAULT_TASK_ANALYSIS: TaskAnalysisResponse = {
  needsClarification: false,
  taskType: 'other',
  taskCategory: 'personal',
  questions: [],
  immediateInsight: null,
}

// ============================================================================
// EMAIL ANALYSIS
// ============================================================================

export const EmailSuggestedTaskSchema = z.object({
  title: z.string(),
  dueDate: z.string().nullable(),
  urgency: z.enum(['high', 'medium', 'low']),
})

export const EmailAnalysisResponseSchema = z.object({
  actionable: z.boolean(),
  category: z.enum(['BILL_DUE', 'APPOINTMENT', 'DEADLINE', 'REQUEST', 'NOT_ACTIONABLE']),
  confidence: z.number().min(0).max(1),
  suggestedTask: EmailSuggestedTaskSchema.nullable(),
  reason: z.string(),
})

export type EmailAnalysisResponse = z.infer<typeof EmailAnalysisResponseSchema>

export const DEFAULT_EMAIL_ANALYSIS: EmailAnalysisResponse = {
  actionable: false,
  category: 'NOT_ACTIONABLE',
  confidence: 0.5,
  suggestedTask: null,
  reason: 'Unable to analyze email',
}

// ============================================================================
// NUDGE MESSAGE
// ============================================================================

export const NudgeMessageSchema = z.object({
  title: z.string(),
  body: z.string(),
})

export type NudgeMessage = z.infer<typeof NudgeMessageSchema>

export function getDefaultNudge(taskTitle: string, daysUntilDue: number, isOverdue: boolean): NudgeMessage {
  if (isOverdue) {
    return {
      title: `${taskTitle.slice(0, 30)} is overdue`,
      body: "It's not too late. What's one small step you could take?",
    }
  }
  if (daysUntilDue <= 1) {
    return {
      title: `${taskTitle.slice(0, 30)} is due tomorrow`,
      body: "You've got this. Start with the first step.",
    }
  }
  return {
    title: `${taskTitle.slice(0, 30)} is coming up`,
    body: `Due in ${daysUntilDue} days. Good time to make progress.`,
  }
}

// ============================================================================
// WEEKLY REFLECTION
// ============================================================================

export const WeeklyReflectionSchema = z.object({
  wins: z.array(z.string()),
  patterns: z.array(z.string()),
  suggestions: z.array(z.string()),
  encouragement: z.string(),
})

export const WeeklyReflectionWithStatsSchema = WeeklyReflectionSchema.extend({
  stats: z.object({
    tasksCompleted: z.number(),
    onTimeCompletions: z.number(),
    busiestDay: z.string(),
    productiveHours: z.string(),
    streakDays: z.number(),
  }),
})

export type WeeklyReflection = z.infer<typeof WeeklyReflectionSchema>
export type WeeklyReflectionWithStats = z.infer<typeof WeeklyReflectionWithStatsSchema>

export function getDefaultReflection(tasksCompleted: number, busiestDay: string): WeeklyReflection {
  return {
    wins: tasksCompleted > 0
      ? [`You completed ${tasksCompleted} task${tasksCompleted > 1 ? 's' : ''} this week`]
      : ['You made it through another week'],
    patterns: busiestDay
      ? [`${busiestDay} seems to be your productive day`]
      : [],
    suggestions: ['Try tackling one small task early in the day'],
    encouragement: "Progress isn't always visible, but you're moving forward.",
  }
}

// ============================================================================
// TASK INTELLIGENCE
// ============================================================================

export const TaskIntelligenceObservationSchema = z.object({
  taskId: z.string(),
  type: z.enum(['stuck', 'vague', 'needs_deadline', 'pattern']),
  observation: z.string(),
  suggestion: z.string(),
  priority: z.number().min(1).max(3),
})

export const TaskIntelligenceResponseSchema = z.array(TaskIntelligenceObservationSchema)

export type TaskIntelligenceObservation = z.infer<typeof TaskIntelligenceObservationSchema>
export type TaskIntelligenceResponse = z.infer<typeof TaskIntelligenceResponseSchema>

export const DEFAULT_TASK_INTELLIGENCE: TaskIntelligenceResponse = []

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Safely parse AI response with fallback
 */
export function parseAIResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T,
  context?: string
): { success: true; data: T } | { success: false; data: T; error: z.ZodError } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Log validation error for debugging (in development)
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[AI Schema Validation] ${context || 'Unknown'} failed:`, result.error.issues)
  }

  return { success: false, data: fallback, error: result.error }
}

/**
 * Extract JSON from AI response text (handles markdown code blocks)
 */
export function extractJSON(text: string): unknown | null {
  // Remove markdown code blocks if present
  let jsonText = text
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1]
  }

  // Try to find JSON object or array
  const jsonMatch = jsonText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (!jsonMatch) {
    return null
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    // Try to repair common JSON issues
    try {
      // Fix missing commas between properties
      const repaired = jsonMatch[0].replace(
        /"([^"]+)"\s*:\s*"([^"]*)"\s*\n\s*"([^"]+)"\s*:/g,
        '"$1": "$2",\n  "$3":'
      )
      return JSON.parse(repaired)
    } catch {
      return null
    }
  }
}
