'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled = false, placeholder = 'Type a message...' }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [])

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border bg-elevated">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="
          flex-1 resize-none
          px-4 py-3
          bg-surface border border-border rounded-xl
          text-[15px] text-text
          placeholder:text-text-muted
          focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-150
        "
        style={{ minHeight: '44px', maxHeight: '120px' }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="
          w-11 h-11 flex-shrink-0
          flex items-center justify-center
          bg-accent text-white
          rounded-xl
          hover:bg-accent/90
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-150
          btn-press
        "
        aria-label="Send message"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <path
            d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
