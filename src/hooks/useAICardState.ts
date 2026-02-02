'use client'

import { useState, useEffect, Dispatch, SetStateAction } from 'react'
import { AICardState } from '@/components/AICard'

export interface AICardStateReturn {
  aiCard: AICardState | null
  setAiCard: Dispatch<SetStateAction<AICardState | null>>
  isFollowUp: boolean
  setIsFollowUp: Dispatch<SetStateAction<boolean>>
}

/**
 * Hook for managing AI card UI state and auto-dismiss behavior.
 *
 * Extracted from useAIConversation to allow reuse of the AI card state
 * management logic independently of the full conversation handling.
 *
 * @param useStackView - Whether the stack view is active (enables auto-dismiss)
 * @returns AI card state and setters
 */
export function useAICardState(useStackView: boolean): AICardStateReturn {
  const [aiCard, setAiCard] = useState<AICardState | null>(null)
  const [isFollowUp, setIsFollowUp] = useState(false)

  // Auto-dismiss AI card after task creation (in Stack View)
  useEffect(() => {
    if (aiCard?.taskCreated && useStackView && !aiCard.thinking && !aiCard.question) {
      const timer = setTimeout(() => {
        setAiCard(null)
      }, 3000) // Dismiss after 3 seconds
      return () => clearTimeout(timer)
    }
  }, [aiCard, useStackView])

  return {
    aiCard,
    setAiCard,
    isFollowUp,
    setIsFollowUp,
  }
}
