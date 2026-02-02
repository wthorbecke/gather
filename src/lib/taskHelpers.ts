import { Task, Step } from '@/hooks/useUserData'
import { OTHER_SPECIFY_OPTION } from '@/config/content'
import type { ChatAction } from '@/lib/api-types'

/**
 * Detect if user input is a question vs a task/step request
 */
export function isQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return (
    lower.endsWith('?') ||
    lower.startsWith('can ') ||
    lower.startsWith('how ') ||
    lower.startsWith('what ') ||
    lower.startsWith('when ') ||
    lower.startsWith('where ') ||
    lower.startsWith('why ') ||
    lower.startsWith('is ') ||
    lower.startsWith('are ') ||
    lower.startsWith('do ') ||
    lower.startsWith('does ') ||
    lower.startsWith('will ') ||
    lower.startsWith('should ') ||
    lower.startsWith('could ') ||
    lower.startsWith('would ') ||
    lower.startsWith('need ') ||
    lower.startsWith('is there ') ||
    lower.startsWith('can i ') ||
    lower.startsWith('do i ') ||
    lower.startsWith('did ') ||
    lower.startsWith('am i ')
  )
}

/**
 * Detect if user input is requesting step breakdown
 */
export function isStepRequest(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return (
    lower.includes('add step') ||
    lower.includes('add steps') ||
    lower.includes('more steps') ||
    lower.includes('break down') ||
    lower.includes('subtask') ||
    lower.includes('checklist') ||
    lower.includes('outline') ||
    lower.includes('step-by-step') ||
    lower.includes('step by step') ||
    lower.includes('steps') ||
    lower.includes('plan for') ||
    lower.includes('plan this')
  )
}

/**
 * Filter AI actions to only allowed types and valid references
 */
export function filterActions(
  actions: Array<{ type: string; stepId?: string | number; title?: string; context?: string; label?: string }>,
  task?: Task | null
): ChatAction[] {
  const allowed = new Set<ChatAction['type']>(['mark_step_done', 'focus_step', 'create_task', 'show_sources'])
  return actions.filter((action): action is ChatAction => {
    if (!action || !allowed.has(action.type as ChatAction['type'])) return false
    if ((action.type === 'mark_step_done' || action.type === 'focus_step') && task) {
      return (task.steps || []).some((step) => step.id === action.stepId)
    }
    if (action.type === 'create_task') {
      return typeof action.title === 'string' && action.title.trim().length > 0
    }
    return true
  })
}

/**
 * Sanitize AI-generated questions for better UX
 */
export function sanitizeQuestions(
  taskName: string,
  questions: Array<{ key: string; question?: string; text?: string; options: string[] }>
): Array<{ key: string; question?: string; text?: string; options: string[] }> {
  return questions.map((q) => {
    const questionText = q.question || q.text || ''
    const normalized = questionText.toLowerCase()

    // Fix tax year options to be current
    if (q.key === 'tax_year') {
      return {
        ...q,
        options: ['2025', '2024', OTHER_SPECIFY_OPTION],
      }
    }

    // Simplify Real ID questions
    if (taskName.toLowerCase().includes('real id') && normalized.includes('real id') && normalized.includes('current')) {
      return {
        ...q,
        question: "Do you already have a star on your driver's license?",
        text: undefined,
        options: ['Yes, I see a star', "No or I'm not sure"],
      }
    }

    return q
  })
}

/**
 * Normalize text for fuzzy matching
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Find a potentially duplicate task based on title similarity
 */
export function findDuplicateTask(input: string, tasks: Task[]): Task | null {
  const inputNorm = normalizeForMatch(input)
  if (!inputNorm) return null
  const inputTokens = new Set(inputNorm.split(' '))

  for (const task of tasks) {
    const titleNorm = normalizeForMatch(task.title)
    if (!titleNorm) continue

    // Exact match
    if (inputNorm === titleNorm) return task

    // Substring match for longer strings
    if (inputNorm.length >= 6 && titleNorm.length >= 6) {
      if (inputNorm.includes(titleNorm) || titleNorm.includes(inputNorm)) {
        return task
      }
    }

    // Token overlap match
    const titleTokens = new Set(titleNorm.split(' '))
    const shared = Array.from(inputTokens).filter((t) => titleTokens.has(t))
    const minTokens = Math.min(inputTokens.size, titleTokens.size)
    const required = Math.max(1, Math.floor(minTokens / 2))
    if (shared.length >= required && shared.length >= 2) {
      return task
    }
  }

  return null
}

/**
 * Build context string from task and optional focused step
 */
export function buildTaskContext(task: Task, focusedStep?: Step | null): string {
  const parts: string[] = []
  const existingSteps = (task.steps || [])
    .map((s, i) => `${i + 1}. ${s.text}${s.done ? ' (done)' : ''}`)
    .join('\n')

  parts.push(`Task: ${task.title}`)
  if (task.description) parts.push(`Description: ${task.description}`)
  if (task.context_text) parts.push(`Context: ${task.context_text}`)
  if (existingSteps) parts.push(`Steps:\n${existingSteps}`)

  if (focusedStep) {
    parts.push(`\nFocused step: "${focusedStep.text}"`)
    if (focusedStep.detail) parts.push(`Detail: ${focusedStep.detail}`)
    if (focusedStep.summary) parts.push(`Summary: ${focusedStep.summary}`)
  }

  return parts.join('\n') || 'No context provided.'
}

/**
 * Keyword map for detecting user completion statements
 */
export const COMPLETION_KEYWORD_MAP: Array<{ trigger: string; hints: string[] }> = [
  // Documents
  { trigger: 'passport', hints: ['passport', 'identity document', 'birth certificate', 'proof of identity', 'id document'] },
  { trigger: 'birth certificate', hints: ['birth certificate', 'identity document', 'proof of identity'] },
  { trigger: 'social security', hints: ['social security', 'ssn', 'social security card', 'ss card'] },
  { trigger: 'license', hints: ['license', 'driver', 'dl', 'id card'] },
  { trigger: 'w-2', hints: ['w-2', 'w2', 'tax form', 'income'] },
  // Actions
  { trigger: 'appointment', hints: ['appointment', 'schedule', 'book', 'reserved', 'slot'] },
  { trigger: 'called', hints: ['call', 'phone', 'spoke', 'talked'] },
  { trigger: 'emailed', hints: ['email', 'sent', 'message', 'contacted'] },
  { trigger: 'paid', hints: ['fee', 'payment', 'pay', 'cost', 'charge', 'paid'] },
  { trigger: 'signed', hints: ['sign', 'signature', 'signed up', 'registered'] },
  { trigger: 'filled', hints: ['fill', 'form', 'application', 'submit'] },
  { trigger: 'downloaded', hints: ['download', 'form', 'pdf', 'document'] },
  { trigger: 'booked', hints: ['book', 'reservation', 'schedule', 'appointment'] },
]

/**
 * Phrases that indicate user completed something
 */
export const COMPLETION_SIGNALS = [
  'i have', 'i got', 'i found', 'i already', 'i completed', 'i finished',
  'i submitted', 'i sent', 'i did', 'i made', 'done with', 'just did',
  'i called', 'i emailed', 'i booked', 'i scheduled', 'i paid', 'i signed up',
  'i filled out', 'i registered', 'i downloaded', 'i printed'
]

/**
 * Phrases that negate completion
 */
export const NEGATION_PATTERNS = [
  'i have not', "i haven't", 'i did not', "i didn't", 'not yet', "haven't yet"
]

/**
 * Check if user message suggests they completed something
 */
export function detectCompletionIntent(message: string): boolean {
  const normalized = message.toLowerCase()
  const hasNegation = NEGATION_PATTERNS.some((p) => normalized.includes(p))
  return !hasNegation && COMPLETION_SIGNALS.some((phrase) => normalized.includes(phrase))
}

/**
 * Find a step that matches what the user said they completed
 */
export function findMatchingStep(
  message: string,
  steps: Step[]
): Step | undefined {
  const normalized = message.toLowerCase()

  const triggered = COMPLETION_KEYWORD_MAP.find((entry) => normalized.includes(entry.trigger))

  return steps.find((step) => {
    if (step.done) return false
    const haystack = `${step.text} ${step.summary || ''} ${step.detail || ''}`.toLowerCase()

    // Check explicit keyword triggers
    if (triggered) {
      return triggered.hints.some((hint) => haystack.includes(hint))
    }

    // Fallback: check if any word from user input appears in step
    const words = normalized.split(/\s+/).filter((w) => w.length > 3)
    return words.some((word) => haystack.includes(word))
  })
}

/**
 * AI response step item - matches the shape returned by subtasks API
 */
export interface AIStepItem {
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
 * Create a Step object from AI response
 */
export function createStepFromAIResponse(
  item: AIStepItem | string,
  index: number
): Step {
  if (typeof item === 'string') {
    return { id: `step-${Date.now()}-${index}`, text: item, done: false }
  }
  return {
    id: `step-${Date.now()}-${index}`,
    text: item.text || String(item),
    done: false,
    summary: item.summary,
    detail: item.detail,
    alternatives: item.alternatives,
    examples: item.examples,
    checklist: item.checklist,
    time: item.time,
    source: item.source,
    action: item.action,
  }
}

/**
 * Map an array of AI step items to Step objects
 */
export function mapAIStepsToSteps(items: (AIStepItem | string)[]): Step[] {
  return items.map((item, index) => createStepFromAIResponse(item, index))
}

/**
 * Create fallback steps when AI fails
 */
export function createFallbackSteps(taskName: string, contextDescription?: string): Step[] {
  return [
    {
      id: `step-${Date.now()}-1`,
      text: `Research how to ${taskName.toLowerCase()}`,
      done: false,
      summary: "Find official process for your specific situation"
    },
    {
      id: `step-${Date.now()}-2`,
      text: `Gather required information (documents, account numbers, etc.)`,
      done: false,
      summary: contextDescription ? `Based on: ${contextDescription}` : 'Collect everything needed'
    },
    {
      id: `step-${Date.now()}-3`,
      text: `Complete the ${taskName.toLowerCase()} process`,
      done: false,
      summary: "Follow the official steps"
    },
    {
      id: `step-${Date.now()}-4`,
      text: `Keep documentation and confirm completion`,
      done: false,
      summary: "Verify it worked"
    },
  ]
}
