'use client'

import { useState, useEffect } from 'react'
import { Modal } from './Modal'

interface ContextCaptureModalProps {
  isOpen: boolean
  taskTitle: string
  onSave: (note: string) => void
  onSkip: () => void
}

export function ContextCaptureModal({ isOpen, taskTitle, onSave, onSkip }: ContextCaptureModalProps) {
  const [note, setNote] = useState('')

  // Reset note when modal opens
  useEffect(() => {
    if (isOpen) {
      setNote('')
    }
  }, [isOpen])

  const handleSave = () => {
    if (note.trim()) {
      onSave(note.trim())
    } else {
      onSkip()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  // Truncate long task titles
  const displayTitle = taskTitle.length > 40
    ? taskTitle.slice(0, 40) + '...'
    : taskTitle

  return (
    <Modal isOpen={isOpen} onClose={onSkip} title="Quick note" maxWidth="400px">
      <div className="p-5">
        <p className="text-sm text-text-soft mb-3">
          Where did you leave off on &ldquo;{displayTitle}&rdquo;?
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Was looking at section 3..."
          className="w-full h-20 p-3 bg-surface rounded-lg border border-border text-text resize-none focus:outline-none focus:border-accent transition-colors"
          autoFocus
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-text-muted">
            {note.length}/200
          </span>
          <div className="flex gap-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-text-muted hover:text-text transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors btn-press"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
