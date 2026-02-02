'use client'

import { useState, useCallback, Dispatch, SetStateAction } from 'react'

export interface ConversationMessage {
  role: string
  content: string
}

export interface ConversationHistoryReturn {
  conversationHistory: ConversationMessage[]
  setConversationHistory: Dispatch<SetStateAction<ConversationMessage[]>>
  clearHistory: () => void
  addMessage: (role: string, content: string) => void
}

/**
 * Hook for managing AI conversation history.
 *
 * Extracted from useAIConversation to provide a focused interface
 * for conversation state management.
 */
export function useConversationHistory(): ConversationHistoryReturn {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])

  const clearHistory = useCallback(() => {
    setConversationHistory([])
  }, [])

  const addMessage = useCallback((role: string, content: string) => {
    setConversationHistory((prev) => [...prev, { role, content }])
  }, [])

  return {
    conversationHistory,
    setConversationHistory,
    clearHistory,
    addMessage,
  }
}
