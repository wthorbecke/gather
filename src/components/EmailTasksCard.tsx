'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthProvider'

interface AIAnalysis {
  category: string
  confidence: number
  suggestedTask?: {
    title: string
    dueDate: string | null
    urgency: string
  }
}

interface PotentialTask {
  id: string
  subject: string
  from: string
  snippet: string
  date: string
  matchedPattern: string
  aiAnalysis?: AIAnalysis
}

interface EmailTasksCardProps {
  onAddTask: (title: string, context: string, dueDate?: string) => void
  onIgnoreSender?: (sender: string) => void
}

// Retry configuration
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

// Category display names and colors
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  BILL_DUE: { label: 'Bill', color: 'text-danger' },
  APPOINTMENT: { label: 'Appointment', color: 'text-accent' },
  DEADLINE: { label: 'Deadline', color: 'text-warning' },
  REQUEST: { label: 'Request', color: 'text-text-soft' },
}

export function EmailTasksCard({ onAddTask, onIgnoreSender }: EmailTasksCardProps) {
  const { session } = useAuth()
  const [potentialTasks, setPotentialTasks] = useState<PotentialTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [hasScanned, setHasScanned] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  const scanEmails = useCallback(async (isRetry = false) => {
    if (!session?.access_token) return

    // Don't increment retry count for manual scans
    if (!isRetry) {
      retryCountRef.current = 0
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/emails/scan', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.needsReauth) {
          setNeedsReauth(true)
          setError('Gmail not connected')
          retryCountRef.current = MAX_RETRIES // Don't retry auth errors
        } else if (response.status === 429 || response.status >= 500) {
          // Rate limited or server error - retry with backoff
          if (retryCountRef.current < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current)
            retryCountRef.current++
            console.log(`[EmailScan] Retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`)
            retryTimeoutRef.current = setTimeout(() => scanEmails(true), delay)
            setError(`Retrying... (${retryCountRef.current}/${MAX_RETRIES})`)
          } else {
            setError(data.error || 'Failed to scan emails after multiple attempts')
          }
        } else {
          setError(data.error || 'Failed to scan emails')
        }
        return
      }

      // Success - reset retry counter
      retryCountRef.current = 0
      setPotentialTasks(data.potentialTasks || [])
      setHasScanned(true)
    } catch (err) {
      console.error('Error scanning emails:', err)

      // Network error - retry with backoff
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current)
        retryCountRef.current++
        console.log(`[EmailScan] Network error, retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`)
        retryTimeoutRef.current = setTimeout(() => scanEmails(true), delay)
        setError(`Connection issue, retrying...`)
      } else {
        setError('Failed to scan emails - check your connection')
      }
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  // Auto-scan on mount if user is authenticated
  useEffect(() => {
    if (session?.access_token && !hasScanned) {
      scanEmails()
    }
  }, [session?.access_token, hasScanned, scanEmails])

  const handleAddTask = (task: PotentialTask) => {
    // Use AI-suggested title and due date if available
    const title = task.aiAnalysis?.suggestedTask?.title || task.subject
    const dueDate = task.aiAnalysis?.suggestedTask?.dueDate || undefined

    onAddTask(
      title,
      `From: ${task.from}\nReceived: ${task.date}\n\n${task.snippet}`,
      dueDate
    )
    setDismissed((prev) => new Set(prev).add(task.id))
  }

  const handleDismiss = (taskId: string) => {
    setDismissed((prev) => new Set(prev).add(taskId))
  }

  const handleIgnoreSender = (task: PotentialTask) => {
    if (onIgnoreSender) {
      onIgnoreSender(task.from)
    }
    // Dismiss all emails from this sender
    const senderTasks = potentialTasks.filter(t => t.from === task.from)
    setDismissed(prev => {
      const newDismissed = new Set(prev)
      senderTasks.forEach(t => newDismissed.add(t.id))
      return newDismissed
    })
  }

  const handleDismissAll = () => {
    const allIds = new Set(potentialTasks.map((t) => t.id))
    setDismissed(allIds)
  }

  // Filter out dismissed tasks
  const visibleTasks = potentialTasks.filter((t) => !dismissed.has(t.id))

  // Don't render anything if no session, no tasks, or all dismissed
  if (!session || visibleTasks.length === 0) {
    // Show a connect Gmail button if we need reauth
    if (needsReauth) {
      return (
        <div className="mb-6 p-4 bg-subtle rounded-lg border border-border-subtle">
          <div className="flex items-center gap-2 text-sm text-text-soft mb-2">
            <svg width={16} height={16} viewBox="0 0 24 24" className="text-text-muted">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" fill="none"/>
              <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
            Connect Gmail to find tasks in your inbox
          </div>
          <p className="text-xs text-text-muted">
            Sign out and sign in again to enable Gmail access
          </p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="mb-6 p-4 bg-subtle rounded-lg border border-border-subtle animate-pulse">
        <div className="flex items-center gap-2 text-sm text-text-soft">
          <svg width={16} height={16} viewBox="0 0 24 24" className="text-text-muted animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="32" strokeDashoffset="32"/>
          </svg>
          Scanning your inbox...
        </div>
      </div>
    )
  }

  // Show retry UI when retries are exhausted
  if (error && !needsReauth && retryCountRef.current >= MAX_RETRIES) {
    return (
      <div className="mb-6 p-4 bg-subtle rounded-lg border border-border-subtle">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-text-soft">{error}</span>
          <button
            onClick={() => scanEmails(false)}
            disabled={loading}
            className="text-xs text-accent hover:text-accent/80 transition-colors btn-press tap-target"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Hide during retry attempts (loading will show instead)
  if (error && !needsReauth) {
    return null
  }

  return (
    <div className="mb-6 bg-card rounded-lg border border-border-subtle overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 bg-subtle border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <svg width={16} height={16} viewBox="0 0 24 24" className="text-accent">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" fill="none"/>
            <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
          {visibleTasks.length} email{visibleTasks.length === 1 ? '' : 's'} that might be tasks
        </div>
        <button
          onClick={handleDismissAll}
          className="text-xs text-text-muted hover:text-text transition-colors btn-press tap-target"
        >
          Dismiss all
        </button>
      </div>

      {/* Email list - compact design */}
      <div className="divide-y divide-border-subtle">
        {visibleTasks.slice(0, 5).map((task) => (
          <div
            key={task.id}
            className="px-4 py-3 hover:bg-subtle/50 transition-colors flex items-center gap-3 group cursor-pointer"
            onClick={() => handleAddTask(task)}
          >
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text truncate">
                {task.subject}
              </div>
              <div className="text-xs text-text-muted mt-0.5 truncate">
                {task.from} · {task.date}
              </div>
            </div>

            {/* Actions - show on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddTask(task)
                }}
                className="px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded transition-colors"
              >
                Add
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDismiss(task.id)
                }}
                className="p-1 text-text-muted hover:text-text transition-colors"
              >
                <svg width={14} height={14} viewBox="0 0 16 16">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Touch-friendly indicator for mobile */}
            <svg
              width={16}
              height={16}
              viewBox="0 0 16 16"
              className="text-text-muted flex-shrink-0 group-hover:hidden"
            >
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
        ))}
      </div>

      {/* Footer with scan again */}
      <div className="px-4 py-3 bg-subtle border-t border-border-subtle flex justify-end">
        <button
          onClick={() => scanEmails(false)}
          disabled={loading}
          className="text-xs text-text-muted hover:text-text transition-colors btn-press tap-target flex items-center gap-1"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" className={loading ? 'animate-spin' : ''}>
            <path d="M21 12a9 9 0 11-9-9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          Scan again
        </button>
      </div>
    </div>
  )
}
