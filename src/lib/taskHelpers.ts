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

// Common words that shouldn't count toward duplicate matching
const STOPWORDS = new Set([
  'a', 'an', 'the', 'my', 'your', 'our', 'their', 'his', 'her', 'its',
  'i', 'me', 'we', 'you', 'it', 'this', 'that', 'these', 'those',
  'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'about',
  'and', 'or', 'but', 'so', 'if', 'then', 'when', 'where', 'how', 'what',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may',
  'get', 'make', 'go', 'come', 'take', 'put', 'set', 'give', 'keep',
  'new', 'old', 'some', 'any', 'all', 'most', 'more', 'less', 'other',
  'up', 'out', 'off', 'down', 'over', 'under', 'through', 'into',
])

/**
 * Filter out stopwords from tokens for more meaningful matching
 */
function filterStopwords(tokens: Set<string>): Set<string> {
  return new Set(Array.from(tokens).filter(t => !STOPWORDS.has(t) && t.length > 2))
}

/**
 * Find a potentially duplicate task based on title similarity
 */
export function findDuplicateTask(input: string, tasks: Task[]): Task | null {
  const inputNorm = normalizeForMatch(input)
  if (!inputNorm) return null
  const inputTokens = filterStopwords(new Set(inputNorm.split(' ')))

  // Need at least one meaningful word to match
  if (inputTokens.size === 0) return null

  for (const task of tasks) {
    const titleNorm = normalizeForMatch(task.title)
    if (!titleNorm) continue

    // Exact match (normalized)
    if (inputNorm === titleNorm) return task

    // Substring match for longer strings
    if (inputNorm.length >= 8 && titleNorm.length >= 8) {
      if (inputNorm.includes(titleNorm) || titleNorm.includes(inputNorm)) {
        return task
      }
    }

    // Token overlap match - using filtered tokens
    const titleTokens = filterStopwords(new Set(titleNorm.split(' ')))
    if (titleTokens.size === 0) continue

    const shared = Array.from(inputTokens).filter((t) => titleTokens.has(t))
    const minTokens = Math.min(inputTokens.size, titleTokens.size)

    // Require at least 2 meaningful shared tokens, or 60%+ of the smaller set
    const requiredByRatio = Math.ceil(minTokens * 0.6)
    if (shared.length >= 2 && shared.length >= requiredByRatio) {
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
 * Create fallback steps when AI fails - uses keyword matching for relevant steps
 */
export function createFallbackSteps(taskName: string, _contextDescription?: string): Step[] {
  const taskLower = taskName.toLowerCase()
  const baseId = Date.now()

  // Keyword-based fallbacks - provide actionable steps for common task types

  if (taskLower.includes('cancel')) {
    return [
      { id: `step-${baseId}-1`, text: 'Find contact info for cancellation', done: false, summary: 'Locate cancellation method', time: '5 min' },
      { id: `step-${baseId}-2`, text: 'Call or use online chat - say "I want to cancel my account"', done: false, summary: 'Direct request works best', time: '10 min' },
      { id: `step-${baseId}-3`, text: 'Get confirmation number or email and save it', done: false, summary: 'Proof of cancellation', time: '2 min' },
    ]
  }

  if (taskLower.includes('pay') || taskLower.includes('bill')) {
    return [
      { id: `step-${baseId}-1`, text: 'Find the bill or invoice (email, mail, or account portal)', done: false, summary: 'Locate what you owe', time: '3 min' },
      { id: `step-${baseId}-2`, text: 'Check the amount and due date', done: false, summary: 'Know the deadline', time: '2 min' },
      { id: `step-${baseId}-3`, text: 'Make the payment and save confirmation', done: false, summary: 'Done + proof', time: '5 min' },
    ]
  }

  if (taskLower.includes('clean') || taskLower.includes('organize') || taskLower.includes('tidy')) {
    return [
      { id: `step-${baseId}-1`, text: 'Set a timer for 15 minutes', done: false, summary: 'Time-boxing prevents overwhelm', time: '1 min' },
      { id: `step-${baseId}-2`, text: 'Pick ONE area to focus on (not the whole space)', done: false, summary: 'Start small', time: '2 min' },
      { id: `step-${baseId}-3`, text: 'Work until the timer goes off, then reassess', done: false, summary: 'Progress over perfection', time: '15 min' },
    ]
  }

  if (taskLower.includes('call') || taskLower.includes('phone')) {
    return [
      { id: `step-${baseId}-1`, text: 'Write down what you need to say or ask (2-3 bullet points)', done: false, summary: 'Preparation reduces anxiety', time: '3 min' },
      { id: `step-${baseId}-2`, text: 'Make the call now (waiting makes it harder)', done: false, summary: 'Just dial', time: '10 min' },
      { id: `step-${baseId}-3`, text: 'Write down any follow-up actions immediately', done: false, summary: 'Capture next steps', time: '2 min' },
    ]
  }

  if (taskLower.includes('buy') || taskLower.includes('shop') || taskLower.includes('order')) {
    return [
      { id: `step-${baseId}-1`, text: 'Decide exactly what you need (be specific)', done: false, summary: 'Avoid decision paralysis', time: '5 min' },
      { id: `step-${baseId}-2`, text: 'Find 1-2 options and pick the first good-enough one', done: false, summary: 'Done beats perfect', time: '10 min' },
      { id: `step-${baseId}-3`, text: 'Order it right now', done: false, summary: 'Lock it in', time: '5 min' },
    ]
  }

  if (taskLower.includes('fix') || taskLower.includes('repair')) {
    return [
      { id: `step-${baseId}-1`, text: 'Search the specific problem + "how to fix"', done: false, summary: 'Find the solution', time: '10 min' },
      { id: `step-${baseId}-2`, text: 'Gather what you need (tools, parts, info)', done: false, summary: 'Prep before starting', time: '10 min' },
      { id: `step-${baseId}-3`, text: 'Follow the fix step by step', done: false, summary: 'One thing at a time', time: '30 min' },
    ]
  }

  if (taskLower.includes('learn') || taskLower.includes('practice') || taskLower.includes('study')) {
    return [
      { id: `step-${baseId}-1`, text: 'Decide on one specific thing to focus on', done: false, summary: 'Narrow focus = faster progress', time: '5 min' },
      { id: `step-${baseId}-2`, text: 'Do 20 minutes of focused practice', done: false, summary: 'Quality over quantity', time: '20 min' },
      { id: `step-${baseId}-3`, text: 'Note what felt hard and what clicked', done: false, summary: 'Builds self-awareness', time: '5 min' },
    ]
  }

  if (taskLower.includes('write') || taskLower.includes('draft') || taskLower.includes('create')) {
    return [
      { id: `step-${baseId}-1`, text: 'Write down 5 bullet points of what you want to say', done: false, summary: 'Raw material first', time: '10 min' },
      { id: `step-${baseId}-2`, text: 'Turn 2-3 bullets into full sentences', done: false, summary: 'Just get words down', time: '15 min' },
      { id: `step-${baseId}-3`, text: 'Read it out loud and fix anything that sounds weird', done: false, summary: 'Your ear catches what eyes miss', time: '10 min' },
    ]
  }

  if (taskLower.includes('appointment') || taskLower.includes('schedule') || taskLower.includes('book')) {
    return [
      { id: `step-${baseId}-1`, text: 'Search for online booking or phone number', done: false, summary: 'Find booking method', time: '5 min' },
      { id: `step-${baseId}-2`, text: 'Check your calendar for 2-3 possible times', done: false, summary: 'Be ready with options', time: '3 min' },
      { id: `step-${baseId}-3`, text: 'Book and add to your calendar immediately', done: false, summary: 'Lock it in', time: '5 min' },
    ]
  }

  if (taskLower.includes('email') || taskLower.includes('message') || taskLower.includes('contact') || taskLower.includes('reply')) {
    return [
      { id: `step-${baseId}-1`, text: 'Write the main point in one sentence', done: false, summary: 'Clarity first', time: '3 min' },
      { id: `step-${baseId}-2`, text: 'Add any necessary context (keep it short)', done: false, summary: 'Respect their time', time: '5 min' },
      { id: `step-${baseId}-3`, text: 'Read once, fix obvious issues, then send', done: false, summary: 'Done beats perfect', time: '3 min' },
    ]
  }

  // Generic fallback - still actionable, not bureaucratic nonsense
  return [
    { id: `step-${baseId}-1`, text: `Search for how to "${taskName}"`, done: false, summary: 'Find the actual process', time: '5 min' },
    { id: `step-${baseId}-2`, text: 'Write down the 3 main things you need to do', done: false, summary: 'Capture the key steps', time: '5 min' },
    { id: `step-${baseId}-3`, text: 'Do the first thing on your list right now', done: false, summary: 'Momentum matters most', time: '15 min' },
  ]
}
