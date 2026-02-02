'use client'

import { RichText } from '../RichText'
import { Task } from '@/hooks/useUserData'

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  taskCreated?: Task
  isStreaming?: boolean
}

interface ChatMessageProps {
  message: ChatMessageData
  onGoToTask?: (taskId: string) => void
}

export function ChatMessage({ message, onGoToTask }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
    >
      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-3
          ${isUser
            ? 'bg-accent text-white rounded-br-md'
            : 'bg-surface border border-border rounded-bl-md'
          }
        `}
      >
        {/* Message content */}
        <div className={`text-[15px] leading-relaxed ${isUser ? '' : 'text-text'}`}>
          {isUser ? (
            message.content
          ) : (
            <>
              <RichText>{message.content}</RichText>
              {message.isStreaming && (
                <span
                  className="inline-block w-2 h-4 ml-0.5 bg-accent/60 rounded-sm"
                  style={{ animation: 'cursorBlink 1s ease-in-out infinite' }}
                />
              )}
            </>
          )}
        </div>

        {/* Task created confirmation */}
        {message.taskCreated && onGoToTask && (
          <button
            onClick={() => onGoToTask(message.taskCreated!.id)}
            className="
              mt-3 p-3 w-full
              bg-card border border-border rounded-lg
              flex items-center gap-3
              hover:bg-card-hover
              transition-colors duration-150
              text-left
            "
          >
            <div className="w-6 h-6 rounded-md bg-success/15 flex items-center justify-center flex-shrink-0">
              <svg width={14} height={14} viewBox="0 0 16 16" className="text-success">
                <path
                  d="M3 8L6.5 11.5L13 4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text truncate">
                {message.taskCreated.title}
              </div>
              <div className="text-xs text-text-muted">
                Tap to view task
              </div>
            </div>
            <svg width={14} height={14} viewBox="0 0 16 16" className="text-text-muted flex-shrink-0">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
