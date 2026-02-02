'use client'

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'

interface ChatModalContextValue {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
}

const ChatModalContext = createContext<ChatModalContextValue | null>(null)

export function ChatModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen(prev => !prev), [])

  return (
    <ChatModalContext.Provider value={{ isOpen, openChat, closeChat, toggleChat }}>
      {children}
    </ChatModalContext.Provider>
  )
}

export function useChatModal(): ChatModalContextValue {
  const context = useContext(ChatModalContext)
  if (!context) {
    throw new Error('useChatModal must be used within ChatModalProvider')
  }
  return context
}
