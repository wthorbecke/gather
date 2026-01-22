'use client'

import { useState, useRef } from 'react'
import { TaskCard } from './TaskCard'
import { TaskDetailModal } from './TaskDetailModal'
import { Task, ClarifyingAnswer } from '@/hooks/useUserData'

// Quick local analysis for urgency/waiting detection (AI handles complexity)
function quickAnalyze(title: string): { suggestedCategory: 'urgent' | 'soon' | 'waiting'; suggestedBadge?: string } {
  const lower = title.toLowerCase()

  // Detect urgency signals
  const urgentKeywords = ['asap', 'urgent', 'today', 'now', 'immediately', 'emergency', '!']
  const isUrgent = urgentKeywords.some(k => lower.includes(k))

  // Detect waiting signals
  const waitingKeywords = ['waiting', 'wait for', 'pending', 'blocked', 'need response']
  const isWaiting = waitingKeywords.some(k => lower.includes(k))

  // Extract potential badge from keywords
  let suggestedBadge: string | undefined
  const dateMatch = title.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight)\b/i)
  if (dateMatch) suggestedBadge = dateMatch[1].charAt(0).toUpperCase() + dateMatch[1].slice(1)

  const dueDateMatch = title.match(/due\s+(.*?)(?:\s|$)/i)
  if (dueDateMatch) suggestedBadge = `Due ${dueDateMatch[1]}`

  return {
    suggestedCategory: isUrgent ? 'urgent' : isWaiting ? 'waiting' : 'soon',
    suggestedBadge,
  }
}

// AI analysis response type
interface AIAnalysis {
  needsClarification: boolean
  taskCategory: string
  questions: Array<{
    id: string
    question: string
    why: string
    options: string[] | null
  }>
  immediateInsight: string | null
}

// Pending task with AI analysis
interface PendingTask {
  title: string
  category: 'urgent' | 'soon' | 'waiting'
  badge?: string
  analysis?: AIAnalysis
  answers: ClarifyingAnswer[]
  currentQuestionIndex: number
}

interface TasksPanelProps {
  tasks: Task[]
  onOpenEmail: (provider: string) => void
  onOpenAIChat: (taskId: string) => void
  onAddTask: (title: string, category: 'urgent' | 'soon' | 'waiting', description?: string, badge?: string, clarifyingAnswers?: ClarifyingAnswer[], taskCategory?: string) => Promise<Task | undefined> | void
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void
  onCompleteTask?: (taskId: string) => void
}

export function TasksPanel({ tasks, onOpenEmail, onOpenAIChat, onAddTask, onUpdateTask, onCompleteTask }: TasksPanelProps) {
  const [quickInput, setQuickInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const urgentTasks = tasks.filter((t) => t.category === 'urgent')
  const soonTasks = tasks.filter((t) => t.category === 'soon')
  const waitingTasks = tasks.filter((t) => t.category === 'waiting')

  // Quick add - analyzes with AI
  const handleQuickAdd = async () => {
    if (!quickInput.trim()) return

    const title = quickInput.trim()
    const { suggestedCategory, suggestedBadge } = quickAnalyze(title)
    
    setQuickInput('')
    setIsAnalyzing(true)

    try {
      // Call AI to analyze the task with a timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout for AI analysis

      const response = await fetch('/api/analyze-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const analysis: AIAnalysis = await response.json()
        
        if (analysis.needsClarification && analysis.questions.length > 0) {
          // Show clarifying questions
          setPendingTask({
            title,
            category: suggestedCategory,
            badge: suggestedBadge,
            analysis,
            answers: [],
            currentQuestionIndex: 0,
          })
        } else {
          // Task is clear enough, add directly
          onAddTask(title, suggestedCategory, undefined, suggestedBadge)
        }
      } else {
        // AI failed, add task anyway
        onAddTask(title, suggestedCategory, undefined, suggestedBadge)
      }
    } catch (error) {
      // Timeout or error - add task without analysis
      console.log('AI analysis skipped (timeout or error), adding task directly')
      onAddTask(title, suggestedCategory, undefined, suggestedBadge)
    }
    
    setIsAnalyzing(false)
  }

  // Answer a clarifying question
  const handleAnswerQuestion = (answer: string) => {
    if (!pendingTask || !pendingTask.analysis) return

    const currentQuestion = pendingTask.analysis.questions[pendingTask.currentQuestionIndex]
    const newAnswers = [...pendingTask.answers, {
      question: currentQuestion.question,
      answer,
    }]

    const nextIndex = pendingTask.currentQuestionIndex + 1
    
    if (nextIndex < pendingTask.analysis.questions.length) {
      // More questions to ask
      setPendingTask({
        ...pendingTask,
        answers: newAnswers,
        currentQuestionIndex: nextIndex,
      })
    } else {
      // All questions answered, add task with context and generate subtasks
      handleFinishWithSubtasks(newAnswers)
    }
  }

  // Skip remaining questions and add task
  const handleSkipQuestions = () => {
    if (!pendingTask) return
    
    onAddTask(
      pendingTask.title,
      pendingTask.category,
      undefined,
      pendingTask.badge,
      pendingTask.answers,
      pendingTask.analysis?.taskCategory
    )
    setPendingTask(null)
  }

  // Finish and generate subtasks
  const handleFinishWithSubtasks = async (answers: ClarifyingAnswer[]) => {
    if (!pendingTask) return

    setIsGeneratingSubtasks(true)
    
    // Add the task first
    const newTask = await onAddTask(
      pendingTask.title,
      pendingTask.category,
      undefined,
      pendingTask.badge,
      answers,
      pendingTask.analysis?.taskCategory
    )

    // Generate subtasks using the context
    try {
      const response = await fetch('/api/suggest-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingTask.title,
          clarifyingAnswers: answers,
          taskCategory: pendingTask.analysis?.taskCategory,
        }),
      })

      if (response.ok && newTask && onUpdateTask) {
        const { subtasks } = await response.json()
        const subtaskObjects = subtasks.map((title: string, i: number) => ({
          id: `st_${Date.now()}_${i}`,
          title,
          completed: false,
        }))
        await onUpdateTask(newTask.id, { subtasks: subtaskObjects })
      }
    } catch (error) {
      console.error('Error generating subtasks:', error)
    }

    setIsGeneratingSubtasks(false)
    setPendingTask(null)
  }

  // Add task without answering questions
  const handleAddWithoutQuestions = () => {
    if (!pendingTask) return
    onAddTask(pendingTask.title, pendingTask.category, undefined, pendingTask.badge)
    setPendingTask(null)
  }

  // Convert task actions from DB format to component format
  const mapActions = (task: Task) => {
    if (!task.actions || !Array.isArray(task.actions)) return []
    return task.actions.map((action) => ({
      ...action,
      onClick: action.type === 'email' && action.email_key
        ? () => onOpenEmail(action.email_key!)
        : action.type === 'ai_help' && action.ai_context
        ? () => onOpenAIChat(action.ai_context!)
        : undefined,
    }))
  }

  // Calculate subtask progress
  const getSubtaskProgress = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return null
    const completed = task.subtasks.filter(s => s.completed).length
    return { completed, total: task.subtasks.length }
  }

  // Get current question if pending
  const currentQuestion = pendingTask?.analysis?.questions[pendingTask.currentQuestionIndex]
  const questionsRemaining = pendingTask?.analysis 
    ? pendingTask.analysis.questions.length - pendingTask.currentQuestionIndex 
    : 0

  return (
    <div className="animate-fade-in">
      {/* Quick Capture Input - Always Visible */}
      <div className="mb-8">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleQuickAdd()
              }
            }}
            placeholder="What's on your mind? Just type and press enter..."
            disabled={isAnalyzing}
            className="w-full px-5 py-4 bg-white border border-[var(--border-light)] rounded-2xl text-[1rem] focus:outline-none focus:border-[var(--accent)] focus:shadow-soft-hover transition-all placeholder:text-[var(--text-muted)] disabled:opacity-50"
          />
          {quickInput && !isAnalyzing && (
            <button
              onClick={handleQuickAdd}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-[var(--text)] text-white text-sm rounded-lg hover:bg-[var(--text-soft)] transition-colors"
            >
              Add
            </button>
          )}
          {isAnalyzing && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
              Thinking...
            </div>
          )}
        </div>
        <p className="text-[0.75rem] text-[var(--text-muted)] mt-2 ml-1">
          Pro tip: Just brain dump. I'll ask smart questions to help you get it done.
        </p>
      </div>

      {/* AI Clarifying Questions Modal */}
      {pendingTask && currentQuestion && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-fade-in">
            {/* Task title */}
            <div className="mb-4 pb-4 border-b border-[var(--border-light)]">
              <div className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-wider mb-1">Adding task</div>
              <h3 className="font-serif text-lg text-[var(--text)]">{pendingTask.title}</h3>
              {pendingTask.analysis?.immediateInsight && (
                <p className="text-[0.85rem] text-[var(--accent)] mt-2">
                  💡 {pendingTask.analysis.immediateInsight}
                </p>
              )}
            </div>

            {/* Question */}
            <div className="mb-6">
              <p className="text-[var(--text)] mb-2">{currentQuestion.question}</p>
              <p className="text-[0.8rem] text-[var(--text-muted)]">{currentQuestion.why}</p>
            </div>

            {/* Options or free text */}
            {currentQuestion.options ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswerQuestion(option)}
                    className="px-4 py-2.5 bg-[var(--bg-warm)] border border-[var(--border-light)] rounded-xl text-[0.9rem] text-[var(--text)] hover:bg-[var(--sky-soft)] hover:border-[var(--sky)] transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Type your answer..."
                autoFocus
                className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[0.9rem] focus:outline-none focus:border-[var(--accent)] mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                    handleAnswerQuestion((e.target as HTMLInputElement).value)
                  }
                }}
              />
            )}

            {/* Progress and skip */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-light)]">
              <span className="text-[0.75rem] text-[var(--text-muted)]">
                Question {pendingTask.currentQuestionIndex + 1} of {pendingTask.analysis?.questions.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleAddWithoutQuestions}
                  className="px-4 py-2 text-[0.85rem] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Skip all
                </button>
                {pendingTask.answers.length > 0 && (
                  <button
                    onClick={handleSkipQuestions}
                    className="px-4 py-2 text-[0.85rem] text-[var(--accent)] hover:text-[var(--text)] transition-colors"
                  >
                    Done, add task
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generating subtasks overlay */}
      {isGeneratingSubtasks && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl text-center">
            <div className="text-3xl mb-4">🧠</div>
            <p className="text-[var(--text)]">Creating your action plan...</p>
            <p className="text-[0.85rem] text-[var(--text-muted)] mt-2">Using your answers to break this down into doable steps</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && !pendingTask && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-50">✓</div>
          <p className="text-[var(--text-soft)] mb-2">No tasks right now.</p>
          <p className="text-[var(--text-muted)] text-sm">Type above to add something.</p>
        </div>
      )}

      {/* Urgent / Needs attention */}
      {urgentTasks.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-light)]">
            <h2 className="font-serif text-xl font-medium text-[var(--text)]">Needs attention</h2>
            <span className="text-[0.75rem] text-[var(--rose)] bg-[var(--rose-soft)] px-2 py-0.5 rounded-full">
              {urgentTasks.length}
            </span>
          </div>
          {urgentTasks.map((task) => {
            const progress = getSubtaskProgress(task)
            return (
              <TaskCard
                key={task.id}
                title={task.title}
                badge={task.badge || 'Urgent'}
                category="urgent"
                description={task.description || ''}
                actions={mapActions(task)}
                onClick={() => setSelectedTask(task)}
                subtaskProgress={progress}
              />
            )
          })}
        </div>
      )}

      {/* Soon */}
      {soonTasks.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-light)]">
            <h2 className="font-serif text-xl font-medium text-[var(--text)]">Coming up</h2>
            <span className="text-[0.75rem] text-[var(--accent)] bg-[var(--bg-warm)] px-2 py-0.5 rounded-full">
              {soonTasks.length}
            </span>
          </div>
          {soonTasks.map((task) => {
            const progress = getSubtaskProgress(task)
            return (
              <TaskCard
                key={task.id}
                title={task.title}
                badge={task.badge || 'Soon'}
                category="soon"
                description={task.description || ''}
                actions={mapActions(task)}
                onClick={() => setSelectedTask(task)}
                subtaskProgress={progress}
              />
            )
          })}
        </div>
      )}

      {/* Waiting on */}
      {waitingTasks.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-light)]">
            <h2 className="font-serif text-xl font-medium text-[var(--text)]">Waiting on</h2>
            <span className="text-[0.75rem] text-[var(--sage)] bg-[var(--sage-soft)] px-2 py-0.5 rounded-full">
              {waitingTasks.length}
            </span>
          </div>
          {waitingTasks.map((task) => {
            const progress = getSubtaskProgress(task)
            return (
              <TaskCard
                key={task.id}
                title={task.title}
                badge={task.badge || 'Waiting'}
                category="waiting"
                onClick={() => setSelectedTask(task)}
                description={task.description || ''}
                actions={mapActions(task)}
                subtaskProgress={progress}
              />
            )
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && onUpdateTask && onCompleteTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={onUpdateTask}
          onComplete={onCompleteTask}
        />
      )}
    </div>
  )
}
