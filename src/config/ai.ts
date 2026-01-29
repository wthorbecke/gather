/**
 * AI Model Configuration
 *
 * Centralizes model selection for different use cases.
 * Update versions here when new models are released.
 */

// Fast model for simple tasks: intent detection, health checks, quick classifications
export const AI_MODEL_FAST = 'claude-3-haiku-20240307'

// Standard model for complex reasoning: task breakdown, conversation, analysis
export const AI_MODEL_STANDARD = 'claude-sonnet-4-20250514'

// Model configuration by use case
export const AI_MODELS = {
  // Quick tasks that need low latency
  intentAnalysis: AI_MODEL_FAST,
  healthCheck: AI_MODEL_FAST,

  // Complex reasoning tasks
  taskBreakdown: AI_MODEL_STANDARD,
  conversation: AI_MODEL_STANDARD,
  taskAnalysis: AI_MODEL_STANDARD,
  taskIntelligence: AI_MODEL_STANDARD,
} as const

// Default max tokens for different use cases
export const AI_MAX_TOKENS = {
  intentAnalysis: 2048,
  taskBreakdown: 4096,
  conversation: 2048,
  healthCheck: 256,
  taskIntelligence: 1024,
} as const

// Temperature settings (0 = deterministic, 1 = creative)
export const AI_TEMPERATURE = {
  intentAnalysis: 0.3,  // More deterministic for classification
  taskBreakdown: 0.5,   // Balanced for step generation
  conversation: 0.7,    // More creative for natural conversation
  taskIntelligence: 0.4, // Balanced: consistent analysis with some personality
} as const
