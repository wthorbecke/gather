'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Modal } from './Modal'
import { CloseButton } from './CloseButton'
import { authFetch } from '@/lib/supabase'

interface ExtractedTask {
  title: string
  firstStep?: string
  originalText?: string
  group?: string
  selected: boolean
}

interface BrainDumpModalProps {
  isOpen: boolean
  onClose: () => void
  onAddTasks: (tasks: Array<{ title: string; firstStep?: string }>) => void
}

type ViewState = 'input' | 'processing' | 'results'

export function BrainDumpModal({ isOpen, onClose, onAddTasks }: BrainDumpModalProps) {
  const [text, setText] = useState('')
  const [viewState, setViewState] = useState<ViewState>('input')
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isMac, setIsMac] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Detect platform on client to avoid SSR hydration mismatch
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes('MAC'))
  }, [])

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && viewState === 'input') {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, viewState])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Delay reset to allow close animation
      const timer = setTimeout(() => {
        setText('')
        setViewState('input')
        setExtractedTasks([])
        setGroups([])
        setError(null)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleProcess = useCallback(async () => {
    if (!text.trim()) return

    setViewState('processing')
    setError(null)

    try {
      const response = await authFetch('/api/brain-dump', {
        method: 'POST',
        body: JSON.stringify({ text: text.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process')
      }

      if (data.tasks && data.tasks.length > 0) {
        // Add selected: true to all tasks by default
        setExtractedTasks(data.tasks.map((t: Omit<ExtractedTask, 'selected'>) => ({ ...t, selected: true })))
        setGroups(data.groups || [])
        setViewState('results')
      } else {
        setError('No tasks found. Try adding more detail about what you need to do.')
        setViewState('input')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setViewState('input')
    }
  }, [text])

  const handleToggleTask = useCallback((index: number) => {
    setExtractedTasks(prev =>
      prev.map((task, i) =>
        i === index ? { ...task, selected: !task.selected } : task
      )
    )
  }, [])

  const handleToggleAll = useCallback((selected: boolean) => {
    setExtractedTasks(prev => prev.map(task => ({ ...task, selected })))
  }, [])

  const handleAddSelected = useCallback(() => {
    const selectedTasks = extractedTasks
      .filter(t => t.selected)
      .map(t => ({ title: t.title, firstStep: t.firstStep }))

    if (selectedTasks.length > 0) {
      onAddTasks(selectedTasks)
      onClose()
    }
  }, [extractedTasks, onAddTasks, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to process
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && viewState === 'input' && text.trim()) {
      e.preventDefault()
      handleProcess()
    }
  }, [viewState, text, handleProcess])

  const selectedCount = extractedTasks.filter(t => t.selected).length

  // Group tasks by their group property
  const groupedTasks = groups.length > 0
    ? groups.map(group => ({
        name: group,
        tasks: extractedTasks.filter(t => t.group === group),
      })).filter(g => g.tasks.length > 0)
    : null

  const ungroupedTasks = groups.length > 0
    ? extractedTasks.filter(t => !t.group || !groups.includes(t.group))
    : extractedTasks

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="540px"
      showHeader={false}
    >
      <div className="flex flex-col min-h-[60vh] max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text">Brain Dump</h2>
            <p className="text-sm text-text-muted mt-0.5">
              {viewState === 'input' && "Just dump everything here"}
              {viewState === 'processing' && "Sorting through your thoughts..."}
              {viewState === 'results' && `Found ${extractedTasks.length} tasks`}
            </p>
          </div>
          <CloseButton onClick={onClose} className="-mr-2" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Input View */}
          {viewState === 'input' && (
            <div className="p-5">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Just dump everything here... I'll help sort it out

Example:
need to call mom back, also gotta schedule that dentist appointment, taxes are due soon should probably start gathering docs, buy groceries - milk eggs bread, gym membership expires next week need to decide if renewing..."
                className="
                  w-full h-64 p-4
                  bg-surface rounded-xl
                  border border-border
                  text-text text-base
                  placeholder:text-text-muted
                  resize-none
                  focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                  transition-colors
                "
              />

              {error && (
                <div className="mt-3 p-3 bg-danger-soft rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {text.length > 0 && `${text.length} characters`}
                </span>
                <span className="text-xs text-text-muted">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-medium">
                    {isMac ? 'Cmd' : 'Ctrl'}
                  </kbd>
                  {' + '}
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-medium">Enter</kbd>
                  {' to process'}
                </span>
              </div>
            </div>
          )}

          {/* Processing View */}
          {viewState === 'processing' && (
            <div className="p-5 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-text-soft text-center">
                Extracting tasks from your brain dump...
              </p>
              <p className="text-text-muted text-sm text-center mt-1">
                This usually takes a few seconds
              </p>
            </div>
          )}

          {/* Results View */}
          {viewState === 'results' && (
            <div className="p-5">
              {/* Select all / none controls */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => handleToggleAll(true)}
                  className="text-sm text-accent hover:text-accent/80 transition-colors"
                >
                  Select all
                </button>
                <span className="text-text-muted">|</span>
                <button
                  onClick={() => handleToggleAll(false)}
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  Select none
                </button>
              </div>

              {/* Grouped tasks */}
              {groupedTasks && groupedTasks.map((group, groupIndex) => (
                <div key={group.name} className="mb-4">
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
                    {group.name}
                  </div>
                  <div className="space-y-2">
                    {group.tasks.map((task, taskIndex) => {
                      const globalIndex = extractedTasks.indexOf(task)
                      return (
                        <TaskItem
                          key={globalIndex}
                          task={task}
                          onToggle={() => handleToggleTask(globalIndex)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Ungrouped tasks */}
              {ungroupedTasks.length > 0 && (
                <div className={groupedTasks && groupedTasks.length > 0 ? 'mt-4' : ''}>
                  {groupedTasks && groupedTasks.length > 0 && ungroupedTasks.length > 0 && (
                    <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
                      Other
                    </div>
                  )}
                  <div className="space-y-2">
                    {ungroupedTasks.map((task) => {
                      const globalIndex = extractedTasks.indexOf(task)
                      return (
                        <TaskItem
                          key={globalIndex}
                          task={task}
                          onToggle={() => handleToggleTask(globalIndex)}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Back to edit button */}
              <button
                onClick={() => setViewState('input')}
                className="mt-4 text-sm text-text-muted hover:text-text flex items-center gap-1.5 transition-colors"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Edit text
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-surface/50">
          {viewState === 'input' && (
            <button
              onClick={handleProcess}
              disabled={!text.trim()}
              className="
                w-full py-3 px-4
                bg-accent text-white
                rounded-xl font-medium
                hover:bg-accent/90
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              Process
            </button>
          )}

          {viewState === 'results' && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="
                  flex-1 py-3 px-4
                  bg-surface text-text
                  rounded-xl font-medium
                  hover:bg-card-hover
                  transition-colors
                "
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelected}
                disabled={selectedCount === 0}
                className="
                  flex-1 py-3 px-4
                  bg-accent text-white
                  rounded-xl font-medium
                  hover:bg-accent/90
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                Add {selectedCount} task{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// Task item component for results view
function TaskItem({ task, onToggle }: { task: ExtractedTask; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`
        w-full text-left p-3 rounded-xl
        transition-all duration-150
        ${task.selected
          ? 'bg-accent/10 border-2 border-accent'
          : 'bg-surface border border-border hover:border-accent/30'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className={`
          w-5 h-5 rounded-md flex-shrink-0 mt-0.5
          flex items-center justify-center
          transition-colors
          ${task.selected
            ? 'bg-accent text-white'
            : 'border-2 border-border'
          }
        `}>
          {task.selected && (
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text">{task.title}</div>
          {task.firstStep && (
            <div className="text-sm text-text-muted mt-1 flex items-center gap-1.5">
              <span className="text-accent">First:</span> {task.firstStep}
            </div>
          )}
          {task.originalText && (
            <div className="text-xs text-text-muted mt-1.5 line-clamp-1 opacity-60">
              From: &ldquo;{task.originalText}&rdquo;
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
