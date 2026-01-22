'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Task, Subtask } from '@/hooks/useUserData'
import { Checkbox } from './Checkbox'
import { SegmentedProgress } from './SegmentedProgress'
import { Confetti, CompletionCelebration } from './Confetti'

interface TaskDetailModalProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<{ success: boolean; error?: string }> | void
  onComplete: (taskId: string) => void
}

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

export function TaskDetailModal({ task, isOpen, onClose, onUpdate, onComplete }: TaskDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Subtask editing
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [newSubtask, setNewSubtask] = useState('')

  // Drag and drop
  const [draggedSubtask, setDraggedSubtask] = useState<string | null>(null)
  const [dragOverSubtask, setDragOverSubtask] = useState<string | null>(null)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Chat
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatThinking, setChatThinking] = useState(false)

  // Celebration
  const [showConfetti, setShowConfetti] = useState(false)
  const [completionName, setCompletionName] = useState<string | null>(null)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Loading
  const [isGenerating, setIsGenerating] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      document.body.style.overflow = 'unset'
      setIsVisible(false)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      setShowDeleteConfirm(false)
      setChatMessages([])
      setChatInput('')
      setEditingSubtask(null)
      onClose()
    }, 250)
  }, [onClose])

  if (!isOpen && !isClosing) return null

  const subtasks = task.subtasks || []
  const completedCount = subtasks.filter((st) => st.completed).length

  const handleUpdate = async (updates: Partial<Task>) => {
    setError(null)
    const result = await onUpdate(task.id, updates)
    if (result && !result.success) {
      setError(result.error || 'Failed to save changes')
    }
  }

  const handleToggleSubtask = (subtaskId: string) => {
    const subtask = subtasks.find(st => st.id === subtaskId)
    const updated = subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    )
    handleUpdate({ subtasks: updated })

    // Check if all subtasks are now complete
    const newCompletedCount = updated.filter(st => st.completed).length
    const wasAllComplete = completedCount === subtasks.length
    const isNowAllComplete = newCompletedCount === subtasks.length && subtasks.length > 0

    if (isNowAllComplete && !wasAllComplete && subtask && !subtask.completed) {
      setShowConfetti(true)
      setCompletionName(task.title)
    }
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

  const handleUpdateSubtaskText = (subtaskId: string, text: string) => {
    if (!text.trim()) {
      setEditingSubtask(null)
      return
    }
    const updated = subtasks.map((st) =>
      st.id === subtaskId ? { ...st, title: text.trim() } : st
    )
    handleUpdate({ subtasks: updated })
    setEditingSubtask(null)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, subtaskId: string) => {
    setDraggedSubtask(subtaskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, subtaskId: string) => {
    e.preventDefault()
    if (subtaskId !== draggedSubtask) {
      setDragOverSubtask(subtaskId)
    }
  }

  const handleDragEnd = () => {
    if (draggedSubtask && dragOverSubtask) {
      const fromIdx = subtasks.findIndex(s => s.id === draggedSubtask)
      const toIdx = subtasks.findIndex(s => s.id === dragOverSubtask)
      if (fromIdx !== -1 && toIdx !== -1) {
        const newSubtasks = [...subtasks]
        const [moved] = newSubtasks.splice(fromIdx, 1)
        newSubtasks.splice(toIdx, 0, moved)
        handleUpdate({ subtasks: newSubtasks })
      }
    }
    setDraggedSubtask(null)
    setDragOverSubtask(null)
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

  // Chat handler with simulated responses
  const handleChat = async () => {
    if (!chatInput.trim()) return
    const userMsg = chatInput
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setChatInput('')
    setChatThinking(true)

    // Try real API first, fall back to simulated response
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          taskTitle: task.title,
          taskDescription: task.description,
          subtasks: subtasks.map(st => st.title),
        }),
      })

      if (response.ok) {
        const { reply } = await response.json()
        setChatMessages(prev => [...prev, { role: 'ai', text: reply }])
      } else {
        // Fallback to simulated response
        simulateResponse(userMsg)
      }
    } catch {
      simulateResponse(userMsg)
    }
    setChatThinking(false)
  }

  const simulateResponse = (userMsg: string) => {
    const lower = userMsg.toLowerCase()
    let response = "I can help with this task — ask me about specific steps, or let me know if you're stuck on something."

    if (lower.includes('add') && lower.includes('step')) {
      const stepMatch = userMsg.match(/add (?:a )?step (?:for |to )?(.+)/i)
      if (stepMatch) {
        const newSt: Subtask = {
          id: 'st_' + Date.now(),
          title: stepMatch[1].trim(),
          completed: false,
        }
        handleUpdate({ subtasks: [...subtasks, newSt] })
        response = `Added "${stepMatch[1].trim()}" to your steps.`
      } else {
        response = "What step would you like to add?"
      }
    } else if (lower.includes('how long') || lower.includes('take')) {
      response = "That depends on the complexity, but I'd estimate a few hours to a day for most steps. Want me to break any down further?"
    } else if (lower.includes('stuck') || lower.includes('help')) {
      response = "Let's figure this out. Which step is giving you trouble? I can suggest alternatives or break it down into smaller pieces."
    }

    setChatMessages(prev => [...prev, { role: 'ai', text: response }])
  }

  const handleDeleteTask = () => {
    onComplete(task.id)
    handleClose()
  }

  // Parse URL from subtask text
  const parseSubtaskUrl = (text: string): { displayText: string; url: string | null } => {
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/)
    if (urlMatch) {
      const url = urlMatch[1]
      let displayText = text.replace(url, '').trim()
      if (displayText.endsWith(':')) {
        displayText = displayText.slice(0, -1)
      }
      return { displayText, url }
    }
    return { displayText: text, url: null }
  }

  return (
    <>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <CompletionCelebration taskName={completionName} onDismiss={() => setCompletionName(null)} />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose()
        }}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm ${
            isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
          }`}
        />

        {/* Modal */}
        <div
          className={`relative w-full max-w-[480px] max-h-[90vh] bg-elevated rounded-2xl overflow-hidden flex flex-col shadow-modal border border-border ${
            isClosing ? 'animate-modal-out' : isVisible ? 'animate-modal-in' : 'opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 pr-3">
                <h2 className="text-xl font-semibold text-text">{task.title}</h2>
                {task.description && (
                  <p className="text-sm text-text-muted mt-1">{task.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-danger-soft text-danger hover:scale-105 active:scale-95 transition-all"
                  aria-label="Delete task"
                >
                  🗑
                </button>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface text-text-muted hover:text-text hover:scale-105 active:scale-95 transition-all"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
            </div>
            <SegmentedProgress completed={completedCount} total={subtasks.length} />
            <p className="text-xs text-text-muted mt-2">
              {completedCount} of {subtasks.length} done
            </p>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="px-4 py-3 bg-danger-soft border-b border-border flex items-center justify-between">
              <p className="text-sm text-danger">Delete this task?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTask}
                  className="px-3 py-1.5 text-sm bg-danger text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-danger-soft border border-danger rounded-lg">
              <p className="text-sm text-danger">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-danger underline mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Subtasks */}
          <div className="flex-1 overflow-y-auto p-4">
            {subtasks.map((st) => {
              const { displayText, url } = parseSubtaskUrl(st.title)
              const isDragging = draggedSubtask === st.id
              const isDragOver = dragOverSubtask === st.id && draggedSubtask !== st.id

              return (
                <div
                  key={st.id}
                  className={`subtask-row flex items-start gap-3 p-3 rounded-md mb-1.5 transition-all ${
                    st.completed ? 'bg-transparent opacity-50' : 'bg-surface'
                  } ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'border-t-2 border-accent translate-y-0.5' : 'border-t-2 border-transparent'}`}
                  draggable={editingSubtask !== st.id}
                  onDragStart={(e) => handleDragStart(e, st.id)}
                  onDragOver={(e) => handleDragOver(e, st.id)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => setDragOverSubtask(null)}
                  style={{ cursor: editingSubtask === st.id ? 'text' : 'grab' }}
                >
                  <Checkbox
                    checked={st.completed}
                    onToggle={() => handleToggleSubtask(st.id)}
                  />
                  <div className="flex-1 min-w-0">
                    {editingSubtask === st.id ? (
                      <input
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleUpdateSubtaskText(st.id, editingText)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateSubtaskText(st.id, editingText)
                          if (e.key === 'Escape') setEditingSubtask(null)
                        }}
                        className="w-full text-base px-2 py-1 rounded-md border border-accent bg-canvas text-text outline-none"
                      />
                    ) : (
                      <p
                        onClick={() => {
                          setEditingSubtask(st.id)
                          setEditingText(st.title)
                        }}
                        className={`text-base cursor-text leading-snug ${
                          st.completed ? 'line-through text-text-muted' : 'text-text'
                        }`}
                      >
                        {displayText}
                      </p>
                    )}
                    {url && !st.completed && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent mt-1 inline-block hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open link →
                      </a>
                    )}
                  </div>
                  <div className="subtask-actions flex items-center gap-1">
                    <span className="text-text-muted text-sm px-1 cursor-grab">⋮⋮</span>
                    <button
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-danger-soft text-danger text-sm hover:scale-105 active:scale-95 transition-all"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Add subtask button */}
            <button
              onClick={() => {
                const text = prompt('Add a step:')
                if (text?.trim()) {
                  const newSt: Subtask = {
                    id: 'st_' + Date.now(),
                    title: text.trim(),
                    completed: false,
                  }
                  handleUpdate({ subtasks: [...subtasks, newSt] })
                }
              }}
              className="w-full p-3 rounded-md border border-dashed border-border text-text-muted text-sm text-left mt-1 hover:border-accent hover:text-accent transition-colors"
            >
              + Add a step
            </button>

            {/* AI suggest button */}
            {subtasks.length === 0 && (
              <button
                onClick={handleGenerateSubtasks}
                disabled={isGenerating}
                className="w-full mt-3 p-3 rounded-md bg-accent-soft text-accent text-sm font-medium hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
              >
                {isGenerating ? '🧠 Thinking...' : 'Break it down for me'}
              </button>
            )}
          </div>

          {/* Chat area */}
          <div className="border-t border-border bg-surface">
            {/* Chat messages */}
            {chatMessages.length > 0 && (
              <div className="max-h-[150px] overflow-y-auto px-4 py-3">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                  >
                    <span
                      className={`inline-block px-3 py-2 rounded-xl text-sm leading-snug max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-accent text-white'
                          : 'bg-elevated text-text'
                      }`}
                    >
                      {msg.text}
                    </span>
                  </div>
                ))}
                {chatThinking && (
                  <div className="flex gap-1 py-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-text-muted animate-dot-pulse"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Chat input */}
            <div className="p-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask me anything about this task..."
                className="flex-1 px-3 py-2.5 rounded-md border border-border bg-elevated text-text text-sm outline-none focus:border-accent"
              />
              {chatInput && (
                <button
                  onClick={handleChat}
                  className="px-4 py-2.5 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
