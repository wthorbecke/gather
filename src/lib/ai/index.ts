/**
 * AI Module
 *
 * Centralized AI functionality for Gather.
 *
 * Usage:
 *   import { callAI, CHAT_SYSTEM_PROMPT, ChatResponseSchema } from '@/lib/ai'
 */

// Client and utilities
export {
  callAI,
  complete,
  completeJSON,
  extractText,
  extractToolUses,
  needsToolUse,
  checkHealth,
  type AIMessage,
  type AIContentBlock,
  type AITool,
  type AIRequestOptions,
  type AIResponse,
  type AIError,
} from './client'

// Prompts
export {
  // Chat
  CHAT_SYSTEM_PROMPT,
  // Task breakdown
  TASK_BREAKDOWN_SYSTEM_PROMPT,
  // Intent analysis
  buildIntentAnalysisPrompt,
  // Task analysis
  buildTaskAnalysisPrompt,
  // Email
  EMAIL_ANALYSIS_PROMPT,
  // Nudge
  buildNudgePrompt,
  // Reflection
  buildWeeklyReflectionPrompt,
  // Task intelligence
  buildTaskIntelligencePrompt,
  type TaskForIntelligence,
  type UserPatterns,
  type InsightHistory,
  // Health check
  HEALTH_CHECK_PROMPT,
} from './prompts'

// Schemas and types
export {
  // Chat
  ChatResponseSchema,
  ChatActionSchema,
  DEFAULT_CHAT_RESPONSE,
  type ChatResponse,
  type ChatAction,
  // Task breakdown
  RichStepSchema,
  StepSourceSchema,
  StepActionSchema,
  TaskBreakdownResponseSchema,
  getDefaultSteps,
  type RichStep,
  type StepSource,
  type StepAction,
  // Intent analysis
  IntentAnalysisResponseSchema,
  ClarifyingQuestionSchema,
  DeadlineSchema,
  DEFAULT_INTENT_RESPONSE,
  type IntentAnalysisResponse,
  type ClarifyingQuestion,
  type Deadline,
  // Task analysis
  TaskAnalysisResponseSchema,
  TaskAnalysisQuestionSchema,
  DEFAULT_TASK_ANALYSIS,
  type TaskAnalysisResponse,
  // Email
  EmailAnalysisResponseSchema,
  EmailSuggestedTaskSchema,
  DEFAULT_EMAIL_ANALYSIS,
  type EmailAnalysisResponse,
  // Nudge
  NudgeMessageSchema,
  getDefaultNudge,
  type NudgeMessage,
  // Reflection
  WeeklyReflectionSchema,
  WeeklyReflectionWithStatsSchema,
  getDefaultReflection,
  type WeeklyReflection,
  type WeeklyReflectionWithStats,
  // Task intelligence
  TaskIntelligenceObservationSchema,
  TaskIntelligenceResponseSchema,
  DEFAULT_TASK_INTELLIGENCE,
  type TaskIntelligenceObservation,
  type TaskIntelligenceResponse,
  // Utilities
  parseAIResponse,
  extractJSON,
} from './schemas'

// Streaming utilities
export {
  createStreamingResponse,
  consumeStream,
  streamChat,
  streamSubtasks,
  type StreamingMessage,
  type StreamingOptions,
  type StreamCallbacks,
  type SSEEventType,
  type SSEEvent,
} from './streaming'

// Task intelligence utilities
export {
  calculateAvgCompletionDays,
  analyzeUserPatterns,
  analyzeInsightHistory,
  transformTask,
  INSIGHT_FREQUENCY_HOURS,
  type TaskRow,
  type TaskRowWithUser,
  type CompletedTaskRow,
  type CompletionRow,
  type CompletionRowWithUser,
  type InsightRow,
  type InsightRowWithUser,
} from './task-intelligence'
