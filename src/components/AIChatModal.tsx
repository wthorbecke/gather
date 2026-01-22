'use client'

import { useState, useRef, useEffect } from 'react'
import { Modal } from './Modal'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AIChatModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  context: string
}

export function AIChatModal({ isOpen, onClose, title, context }: AIChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset when modal opens with new context
  useEffect(() => {
    if (isOpen) {
      setMessages([])
      setInput('')
    }
  }, [isOpen, context])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context,
          history: messages,
        }),
      })

      const data = await response.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Something went wrong. Please try again." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 mb-4 min-h-[200px]">
        {messages.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm">
            What&apos;s confusing or scary about this? I&apos;ll help break it down.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl text-[0.9rem] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[var(--bg-warm)] ml-8'
                : 'bg-[var(--sage-soft)] mr-8'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: msg.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n- /g, '<br/>• ')
                    .replace(/`(.*?)`/g, '<code class="bg-black/5 px-1.5 py-0.5 rounded text-[0.85rem]">$1</code>'),
                }}
              />
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 text-[var(--text-muted)] text-sm">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[var(--accent-soft)] rounded-full loading-dot" />
              <span className="w-1.5 h-1.5 bg-[var(--accent-soft)] rounded-full loading-dot" />
              <span className="w-1.5 h-1.5 bg-[var(--accent-soft)] rounded-full loading-dot" />
            </div>
            <span>Thinking & searching...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-3 pt-4 border-t border-[var(--border-light)]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="What's confusing or scary about this?"
          rows={2}
          className="flex-1 px-4 py-3 border border-[var(--border)] rounded-xl text-[0.9rem] bg-[var(--bg)] resize-none focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 bg-[var(--text)] text-white rounded-xl text-[0.9rem] hover:bg-[var(--text-soft)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Send
        </button>
      </div>
    </Modal>
  )
}
