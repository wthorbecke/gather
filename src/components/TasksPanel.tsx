'use client'

import { useState, useRef } from 'react'
import { TaskCard } from './TaskCard'
import { TaskDetailModal } from './TaskDetailModal'
import { Task, ClarifyingAnswer, Subtask } from '@/hooks/useUserData'
import { Modal } from './Modal'

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
  const [inputFocused, setInputFocused] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter out completed tasks
  const activeTasks = tasks.filter((t) => t.category !== 'completed')
  const totalSteps = activeTasks.reduce((acc, t) => acc + (t.subtasks?.length || 0), 0)
  const completedSteps = activeTasks.reduce((acc, t) => acc + (t.subtasks?.filter(s => s.completed).length || 0), 0)

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
      const timeoutId = setTimeout(() => controller.abort(), 15000)

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
    } catch {
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
        const subtaskObjects: Subtask[] = subtasks.map((title: string, i: number) => ({
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

  return (
    <div className="animate-fade-in">
      {/* Hero Input */}
      <div className="mb-12">
        <div
          className={`bg-elevated rounded-2xl border transition-all duration-300 ease-spring ${
            inputFocused
              ? 'border-accent shadow-elevated scale-[1.01]'
              : 'border-border shadow-soft'
          }`}
        >
          <div className="p-6 pb-4">
            <input
              ref={inputRef}
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleQuickAdd()
                }
              }}
              placeholder="What's on your mind?"
              disabled={isAnalyzing}
              className="w-full text-2xl font-medium bg-transparent border-none outline-none text-text placeholder:text-text-muted disabled:opacity-50"
            />
          </div>
          <div className="px-6 pb-5 flex justify-between items-center">
            <p className="text-sm text-text-muted">
              {inputFocused ? "I'll break it into steps" : "Dump it here — I'll make it doable"}
            </p>
            {quickInput && !isAnalyzing && (
              <button
                onClick={handleQuickAdd}
                className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-md hover:opacity-90 active:scale-[0.97] transition-all ml-3"
              >
                Break it down
              </button>
            )}
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-text-muted text-sm ml-3">
                <span className="animate-float">🧠</span>
                <span>Thinking...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Clarifying Questions Modal */}
      {pendingTask && currentQuestion && (
        <Modal
          isOpen={true}
          onClose={() => setPendingTask(null)}
          maxWidth="440px"
          showHeader={false}
        >
          <div className="p-6">
            {/* Task title */}
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-text">{pendingTask.title}</h2>
              <p className="text-sm text-text-muted mt-1">Let me break this down</p>
            </div>

            {/* AI insight */}
            {pendingTask.analysis?.immediateInsight && (
              <div className="p-4 bg-surface rounded-lg mb-5 border-l-[3px] border-accent">
                <p className="text-sm text-text-soft leading-relaxed">
                  {pendingTask.analysis.immediateInsight}
                </p>
              </div>
            )}

            {/* Question */}
            <div className="mb-5">
              <p className="font-medium text-text mb-2">{currentQuestion.question}</p>
              <p className="text-sm text-text-soft">{currentQuestion.why}</p>
            </div>

            {/* Options */}
            {currentQuestion.options ? (
              <div className="flex flex-wrap gap-2 mb-5">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswerQuestion(option)}
                    className="flex-1 min-w-[120px] px-4 py-3 bg-transparent border border-border rounded-lg text-sm text-text hover:bg-surface active:scale-[0.98] transition-all"
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
                className="w-full px-4 py-3 bg-elevated border border-border rounded-md text-sm text-text outline-none focus:border-accent mb-5"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                    handleAnswerQuestion((e.target as HTMLInputElement).value)
                  }
                }}
              />
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-xs text-text-muted">
                Question {pendingTask.currentQuestionIndex + 1} of {pendingTask.analysis?.questions.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleAddWithoutQuestions}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                {pendingTask.answers.length > 0 && (
                  <button
                    onClick={handleSkipQuestions}
                    className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Add this
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Generating subtasks overlay */}
      {isGeneratingSubtasks && (
        <Modal isOpen={true} onClose={() => {}} maxWidth="350px" showHeader={false}>
          <div className="p-8 text-center">
            <div className="text-4xl mb-4 animate-float">🧠</div>
            <p className="font-medium text-text">Researching...</p>
            <p className="text-sm text-text-muted mt-2">Creating your action plan</p>
          </div>
        </Modal>
      )}

      {/* Task List */}
      {activeTasks.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
              In progress
            </p>
            {totalSteps > 0 && (
              <p className="text-sm text-text-muted">
                {completedSteps}/{totalSteps} steps
              </p>
            )}
          </div>
          <div>
            {activeTasks.map((task, i) => {
              const progress = getSubtaskProgress(task)
              return (
                <div
                  key={task.id}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className="animate-fade-up"
                >
                  <TaskCard
                    title={task.title}
                    context={task.description}
                    badge={task.badge}
                    category={task.category as 'urgent' | 'soon' | 'waiting'}
                    actions={mapActions(task)}
                    onClick={() => setSelectedTask(task)}
                    subtaskProgress={progress}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeTasks.length === 0 && !pendingTask && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">✨</div>
          <p className="text-base text-text-soft mb-1">Nothing yet.</p>
          <p className="text-sm text-text-muted">Type something above to start.</p>
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
