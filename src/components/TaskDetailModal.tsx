'use client'

import { useState } from 'react'
import { Task, Subtask } from '@/hooks/useUserData'

interface TaskDetailModalProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<{ success: boolean; error?: string }> | void
  onComplete: (taskId: string) => void
}

export function TaskDetailModal({ task, isOpen, onClose, onUpdate, onComplete }: TaskDetailModalProps) {
  const [notes, setNotes] = useState(task.notes || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const subtasks = task.subtasks || []

  const handleUpdate = async (updates: Partial<Task>) => {
    setError(null)
    const result = await onUpdate(task.id, updates)
    if (result && !result.success) {
      setError(result.error || 'Failed to save changes')
    }
  }

  const handleNotesChange = (value: string) => {
    setNotes(value)
    handleUpdate({ notes: value })
  }

  const handleToggleSubtask = (subtaskId: string) => {
    const updated = subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    )
    handleUpdate({ subtasks: updated })
  }

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return
    const newSt: Subtask = {
      id: 'st_' + Date.now(),
      title: newSubtask.trim(),
      completed: false,
    }
    handleUpdate({ subtasks: [...subtasks, newSt] })
    setNewSubtask('')
  }

  const handleDeleteSubtask = (subtaskId: string) => {
    const updated = subtasks.filter((st) => st.id !== subtaskId)
    handleUpdate({ subtasks: updated })
  }

  const handleGenerateSubtasks = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch('/api/suggest-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          notes: notes,
          existingSubtasks: subtasks.map((st) => st.title),
        }),
      })

      if (response.ok) {
        const { subtasks: suggestions } = await response.json()
        const newSubtasks: Subtask[] = suggestions.map((title: string, i: number) => ({
          id: 'st_' + Date.now() + '_' + i,
          title,
          completed: false,
        }))
        await handleUpdate({ subtasks: [...subtasks, ...newSubtasks] })
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to generate suggestions')
      }
    } catch (err) {
      console.error('Error generating subtasks:', err)
      setError('Failed to connect to AI service')
    }
    setIsGenerating(false)
  }

  const completedCount = subtasks.filter((st) => st.completed).length
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0

  const handleCompleteTask = () => {
    onComplete(task.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[var(--bg)] rounded-2xl w-full max-w-2xl my-8 shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-light)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {task.badge && (
                  <span className="text-[0.7rem] px-2 py-0.5 bg-[var(--rose-soft)] text-[var(--text)] rounded-full">
                    {task.badge}
                  </span>
                )}
              </div>
              <h2 className="font-serif text-2xl text-[var(--text)]">{task.title}</h2>
              {task.description && (
                <p className="text-[var(--text-soft)] mt-2">{task.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none"
            >
              x
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-[var(--rose-soft)] border border-[var(--rose)] rounded-xl">
            <div className="flex items-start gap-2">
              <span className="text-[var(--rose)]">⚠️</span>
              <div className="flex-1">
                <p className="text-[0.85rem] text-[var(--rose)]">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-[0.75rem] text-[var(--rose)] underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {subtasks.length > 0 && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--sage)] transition-all duration-300"
                  style={{ width: progress + '%' }}
                />
              </div>
              <span className="text-[0.8rem] text-[var(--text-muted)]">
                {completedCount}/{subtasks.length}
              </span>
            </div>
          </div>
        )}

        {/* Subtasks */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-[var(--text)]">Break it down</h3>
            <button
              onClick={handleGenerateSubtasks}
              disabled={isGenerating}
              className="text-[0.8rem] text-[var(--accent)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
            >
              {isGenerating ? 'Thinking...' : 'Suggest steps'}
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {subtasks.map((st) => {
              // Detect special item types
              const isGatherItem = st.title.toLowerCase().startsWith('gather:')
              const isReminderItem = st.title.toLowerCase().startsWith('reminder:')
              // Detect if there's a URL in the title
              const urlMatch = st.title.match(/(https?:\/\/[^\s]+)/)
              const hasUrl = !!urlMatch
              
              // Parse title and URL
              let displayTitle = st.title
              let url = ''
              if (hasUrl && urlMatch) {
                url = urlMatch[1]
                displayTitle = st.title.replace(url, '').trim()
                // Remove trailing colon if present
                if (displayTitle.endsWith(':')) {
                  displayTitle = displayTitle.slice(0, -1)
                }
              }

              return (
                <div
                  key={st.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border group transition-all ${
                    isGatherItem 
                      ? 'bg-[var(--sky-soft)] border-[var(--sky-soft)]' 
                      : isReminderItem
                      ? 'bg-[var(--rose-soft)] border-[var(--rose-soft)]'
                      : hasUrl
                      ? 'bg-[var(--sage-soft)] border-[var(--sage-soft)]'
                      : 'bg-white border-[var(--border-light)]'
                  }`}
                >
                  <button
                    onClick={() => handleToggleSubtask(st.id)}
                    className={'w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all mt-0.5 ' +
                      (st.completed
                        ? 'bg-[var(--sage)] border-[var(--sage)]'
                        : 'border-[var(--border)] hover:border-[var(--sage)]')
                    }
                  >
                    {st.completed && (
                      <svg className="w-full h-full text-white p-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[0.9rem] ${st.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
                      {isGatherItem && <span className="text-[var(--accent)] font-medium">📋 </span>}
                      {isReminderItem && <span className="text-[var(--rose)] font-medium">🔔 </span>}
                      {displayTitle}
                    </span>
                    {hasUrl && !st.completed && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 mt-1.5 text-[0.8rem] text-[var(--accent)] hover:text-[var(--text)] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>→</span>
                        <span className="underline truncate">{url.replace('https://', '').replace('www.', '').split('/')[0]}</span>
                        <span className="text-[var(--text-muted)]">↗</span>
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteSubtask(st.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--rose)] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add subtask */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              placeholder="Add a step..."
              className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-xl text-[0.9rem] bg-white focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleAddSubtask}
              className="px-4 py-2.5 bg-[var(--text)] text-white rounded-xl text-[0.9rem]"
            >
              Add
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="px-6 pb-6">
          <h3 className="font-medium text-[var(--text)] mb-3">Notes and context</h3>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add any context, links, or notes that might help..."
            rows={4}
            className="w-full px-4 py-3 border border-[var(--border)] rounded-xl text-[0.9rem] bg-white focus:outline-none focus:border-[var(--accent)] resize-none"
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleCompleteTask}
            className="flex-1 py-3 bg-[var(--sage)] text-white rounded-xl text-[0.9rem] hover:opacity-90 transition-opacity"
          >
            Mark complete
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-[var(--border)] text-[var(--text-muted)] rounded-xl text-[0.9rem] hover:bg-[var(--bg-warm)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
