'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthProvider'
import { DEMO_EMAILS } from '@/lib/demo-data'

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
  isDemoUser?: boolean
}

// Retry configuration
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

// Cache configuration - don't re-scan more than once per 5 minutes
const SCAN_CACHE_KEY = 'gather_email_scan_cache'
const SCAN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

interface ScanCache {
  timestamp: number
  results: PotentialTask[]
}

function getCachedScan(): ScanCache | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = sessionStorage.getItem(SCAN_CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached) as ScanCache
    // Check if cache is still valid
    if (Date.now() - parsed.timestamp < SCAN_COOLDOWN_MS) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function setCachedScan(results: PotentialTask[]) {
  if (typeof window === 'undefined') return
  try {
    const cache: ScanCache = { timestamp: Date.now(), results }
    sessionStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage full or unavailable - ignore
  }
}

// Category display names and colors
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  BILL_DUE: { label: 'Bill', color: 'text-danger' },
  APPOINTMENT: { label: 'Appointment', color: 'text-accent' },
  DEADLINE: { label: 'Deadline', color: 'text-warning' },
  REQUEST: { label: 'Request', color: 'text-text-soft' },
}

export function EmailTasksCard({ onAddTask, onIgnoreSender, isDemoUser }: EmailTasksCardProps) {
  const { session } = useAuth()
  const [potentialTasks, setPotentialTasks] = useState<PotentialTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [hasScanned, setHasScanned] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load demo data when in demo mode
  useEffect(() => {
    if (isDemoUser) {
      const demoTasks: PotentialTask[] = DEMO_EMAILS.map((email) => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        snippet: email.snippet,
        date: new Date().toISOString(),
        matchedPattern: 'demo',
        aiAnalysis: {
          category: 'ACTION',
          confidence: 0.9,
          suggestedTask: {
            title: email.subject,
            dueDate: null,
            urgency: 'medium',
          },
        },
      }))
      setPotentialTasks(demoTasks)
      setHasScanned(true)
    }
  }, [isDemoUser])

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
            // Debug log removed(`[EmailScan] Retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`)
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

      // Success - reset retry counter and cache results
      retryCountRef.current = 0
      const results = data.potentialTasks || []
      setPotentialTasks(results)
      setHasScanned(true)
      setCachedScan(results)
    } catch (err) {
      // Error handled silently('Error scanning emails:', err)

      // Network error - retry with backoff
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current)
        retryCountRef.current++
        // Debug log removed(`[EmailScan] Network error, retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`)
        retryTimeoutRef.current = setTimeout(() => scanEmails(true), delay)
        setError(`Connection issue, retrying...`)
      } else {
        setError('Failed to scan emails - check your connection')
      }
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  // Auto-scan on mount if user is authenticated (with caching)
  useEffect(() => {
    if (session?.access_token && !hasScanned && !isDemoUser) {
      // Check cache first to avoid unnecessary API calls
      const cached = getCachedScan()
      if (cached) {
        setPotentialTasks(cached.results)
        setHasScanned(true)
        return
      }
      scanEmails()
    }
  }, [session?.access_token, hasScanned, scanEmails, isDemoUser])

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
      <div className="mb-6 bg-card rounded-lg border border-border-subtle overflow-hidden">
        {/* Skeleton header */}
        <div className="px-4 py-3 bg-subtle border-b border-border-subtle flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-surface skeleton" />
          <div className="h-4 w-40 rounded bg-surface skeleton" />
        </div>
        {/* Skeleton items */}
        <div className="divide-y divide-border-subtle">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3" style={{ opacity: 1 - i * 0.2 }}>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-3/4 rounded bg-surface skeleton" />
                <div className="h-3 w-1/2 rounded bg-surface skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Show retry UI when retries are exhausted
  if (error && !needsReauth && retryCountRef.current >= MAX_RETRIES) {
    return (
      <div className="mb-6 p-4 bg-subtle rounded-lg border border-border-subtle">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-danger-soft flex items-center justify-center flex-shrink-0">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text mb-1">Couldn&apos;t check your inbox</p>
            <p className="text-xs text-text-muted mb-3">This might be a temporary issue. Your data is safe.</p>
            <button
              onClick={() => scanEmails(false)}
              disabled={loading}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-accent bg-accent-soft rounded-md hover:bg-accent/15 transition-colors duration-150 ease-out btn-press"
            >
              Try again
            </button>
          </div>
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
          className="text-xs text-text-muted hover:text-text transition-colors duration-150 ease-out btn-press tap-target"
        >
          Dismiss all
        </button>
      </div>

      {/* Email list - compact design */}
      <div className="divide-y divide-border-subtle">
        {visibleTasks.slice(0, 5).map((task) => (
          <div
            key={task.id}
            className="px-4 py-3 min-h-[44px] hover:bg-subtle/50 transition-colors duration-150 ease-out flex items-center gap-3 group cursor-pointer"
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
                className="px-3 py-2 min-h-[44px] text-xs font-medium text-accent hover:bg-accent/10 rounded transition-colors duration-150 ease-out"
              >
                Add
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDismiss(task.id)
                }}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text transition-colors duration-150 ease-out"
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
