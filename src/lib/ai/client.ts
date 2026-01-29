/**
 * AI Client with Retry Logic
 *
 * Centralized client for all Anthropic API calls.
 * Includes exponential backoff, rate limit handling, and error recovery.
 */

import { AI_MODELS, AI_MAX_TOKENS, AI_TEMPERATURE } from '@/config/ai'

// ============================================================================
// TYPES
// ============================================================================

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string | AIContentBlock[]
}

export interface AIContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'web_search_tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: unknown
}

export interface AITool {
  name: string
  description?: string
  type?: string
  input_schema?: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface AIRequestOptions {
  model?: keyof typeof AI_MODELS
  maxTokens?: number
  temperature?: number
  system?: string
  messages: AIMessage[]
  tools?: AITool[]
  maxRetries?: number
  timeout?: number
}

export interface AIResponse {
  content: AIContentBlock[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  model: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface AIError {
  type: 'rate_limit' | 'overloaded' | 'auth' | 'invalid_request' | 'server' | 'network' | 'timeout'
  message: string
  retryable: boolean
  retryAfter?: number
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 30000 // 30 seconds

// Exponential backoff delays (in ms)
const RETRY_DELAYS = [1000, 2000, 4000] // 1s, 2s, 4s

// ============================================================================
// ERROR HANDLING
// ============================================================================

function classifyError(status: number, errorBody?: string): AIError {
  if (status === 429) {
    return {
      type: 'rate_limit',
      message: 'Rate limit exceeded. Please wait a moment.',
      retryable: true,
      retryAfter: 5000,
    }
  }

  if (status === 529 || errorBody?.includes('overloaded')) {
    return {
      type: 'overloaded',
      message: 'AI service is temporarily busy.',
      retryable: true,
      retryAfter: 10000,
    }
  }

  if (status === 401 || status === 403) {
    return {
      type: 'auth',
      message: 'API authentication failed.',
      retryable: false,
    }
  }

  if (status === 400) {
    return {
      type: 'invalid_request',
      message: 'Invalid request to AI service.',
      retryable: false,
    }
  }

  if (status >= 500) {
    return {
      type: 'server',
      message: 'AI service error. Retrying...',
      retryable: true,
      retryAfter: 2000,
    }
  }

  return {
    type: 'network',
    message: 'Network error connecting to AI service.',
    retryable: true,
    retryAfter: 1000,
  }
}

// ============================================================================
// MAIN CLIENT
// ============================================================================

/**
 * Make an AI request with automatic retry and error handling
 */
export async function callAI(options: AIRequestOptions): Promise<{ data: AIResponse | null; error: AIError | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      data: null,
      error: {
        type: 'auth',
        message: 'API key not configured',
        retryable: false,
      },
    }
  }

  const {
    model = 'conversation',
    maxTokens,
    temperature,
    system,
    messages,
    tools,
    maxRetries = DEFAULT_MAX_RETRIES,
    timeout = DEFAULT_TIMEOUT,
  } = options

  const modelId = AI_MODELS[model]
  const tokens = maxTokens ?? AI_MAX_TOKENS[model as keyof typeof AI_MAX_TOKENS] ?? 2048
  const temp = temperature ?? AI_TEMPERATURE[model as keyof typeof AI_TEMPERATURE]

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: tokens,
    messages,
  }

  if (system) {
    body.system = system
  }

  if (temp !== undefined) {
    body.temperature = temp
  }

  if (tools && tools.length > 0) {
    body.tools = tools
  }

  let lastError: AIError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        lastError = classifyError(response.status, errorText)

        if (!lastError.retryable || attempt === maxRetries) {
          return { data: null, error: lastError }
        }

        // Wait before retry
        const delay = lastError.retryAfter ?? RETRY_DELAYS[attempt] ?? 4000
        await sleep(delay)
        continue
      }

      const data = await response.json()
      return { data, error: null }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = {
          type: 'timeout',
          message: 'Request timed out',
          retryable: true,
          retryAfter: 2000,
        }
      } else {
        lastError = {
          type: 'network',
          message: err instanceof Error ? err.message : 'Network error',
          retryable: true,
          retryAfter: 1000,
        }
      }

      if (attempt === maxRetries) {
        return { data: null, error: lastError }
      }

      await sleep(RETRY_DELAYS[attempt] ?? 4000)
    }
  }

  return { data: null, error: lastError }
}

/**
 * Extract text from AI response content blocks
 */
export function extractText(content: AIContentBlock[]): string {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('')
}

/**
 * Check if response needs tool handling (agentic loop)
 */
export function needsToolUse(response: AIResponse): boolean {
  return response.stop_reason === 'tool_use'
}

/**
 * Extract tool use requests from response
 */
export function extractToolUses(content: AIContentBlock[]): Array<{ id: string; name: string; input: Record<string, unknown> }> {
  return content
    .filter((block) => block.type === 'tool_use')
    .map((block) => ({
      id: block.id!,
      name: block.name!,
      input: block.input || {},
    }))
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Simple text completion (no tools, no history)
 */
export async function complete(
  prompt: string,
  options?: {
    system?: string
    model?: keyof typeof AI_MODELS
    maxTokens?: number
  }
): Promise<{ text: string | null; error: AIError | null }> {
  const { data, error } = await callAI({
    messages: [{ role: 'user', content: prompt }],
    ...options,
  })

  if (error || !data) {
    return { text: null, error }
  }

  return { text: extractText(data.content), error: null }
}

/**
 * JSON completion with extraction
 */
export async function completeJSON<T>(
  prompt: string,
  options?: {
    system?: string
    model?: keyof typeof AI_MODELS
    maxTokens?: number
  }
): Promise<{ data: T | null; text: string | null; error: AIError | null }> {
  const { text, error } = await complete(prompt, options)

  if (error || !text) {
    return { data: null, text: null, error }
  }

  // Extract JSON from response
  try {
    // Remove markdown code blocks if present
    let jsonText = text
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1]
    }

    // Find JSON object or array
    const jsonMatch = jsonText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as T
      return { data: parsed, text, error: null }
    }
  } catch {
    // JSON parsing failed
  }

  return { data: null, text, error: null }
}

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if the AI service is available
 */
export async function checkHealth(): Promise<{ ok: boolean; message: string }> {
  const { text, error } = await complete('Say "ok" and nothing else.', {
    model: 'healthCheck',
    maxTokens: 10,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true, message: text || 'ok' }
}
