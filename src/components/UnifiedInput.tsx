'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { content } from '@/config/content'

interface SearchResult {
  type: 'task' | 'step'
  task: Task
  step?: Step
}

interface ContextTag {
  type: 'task' | 'step'
  label: string
  task?: Task
  step?: Step
}

interface UnifiedInputProps {
  tasks: Task[]
  contextTags?: ContextTag[]  // Current context tags
  onSubmit: (value: string) => void
  onQuickAdd?: (value: string) => void
  onSelectResult?: (result: SearchResult) => void
  onRemoveTag?: (index: number) => void
  placeholder?: string
  allowDropdown?: boolean
  autoFocus?: boolean
  animatedPlaceholders?: string[]
  containerClassName?: string
  inputWrapperClassName?: string
}

export function UnifiedInput({
  tasks,
  contextTags = [],
  onSubmit,
  onQuickAdd,
  onSelectResult,
  onRemoveTag,
  placeholder = content.placeholders.homeInput,
  allowDropdown = true,
  autoFocus = false,
  animatedPlaceholders = [],
  containerClassName = '',
  inputWrapperClassName = '',
}: UnifiedInputProps) {
  const hasContext = contextTags.length > 0
  const stepTagIndex = contextTags.findIndex((tag) => tag.type === 'step')
  const stepTag = stepTagIndex >= 0 ? contextTags[stepTagIndex] : null
  const visibleTagEntries = contextTags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => (stepTag ? tag.type !== 'step' : true))
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [animatedText, setAnimatedText] = useState('')
  const [animatedIndex, setAnimatedIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  // Search results
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = value.toLowerCase().trim()
    if (!q) return []

    const results: SearchResult[] = []
    for (const task of tasks) {
      if (task.title.toLowerCase().includes(q)) {
        results.push({ type: 'task', task })
      }
      const steps = task.steps || []
      for (const step of steps) {
        if (step.text.toLowerCase().includes(q)) {
          results.push({ type: 'step', task, step })
        }
      }
    }
    return results.slice(0, 4)
  }, [value, tasks])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    onSubmit(value.trim())
    setValue('')
    setFocused(false)
  }

  const handleQuickAdd = () => {
    if (!value.trim() || !onQuickAdd) return
    onQuickAdd(value.trim())
    setValue('')
    setFocused(false)
  }

  const handleSelectResult = (result: SearchResult) => {
    if (onSelectResult) {
      onSelectResult(result)
    }
    setValue('')
    setFocused(false)
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    const i = text.toLowerCase().indexOf(query.toLowerCase())
    if (i === -1) return text
    return (
      <>
        {text.slice(0, i)}
        <span className="text-accent font-semibold">{text.slice(i, i + query.length)}</span>
        {text.slice(i + query.length)}
      </>
    )
  }

  const showDropdown = allowDropdown && focused && value.trim()

  const shouldAnimatePlaceholder =
    animatedPlaceholders.length > 0 && !focused && !value && !hasContext

  useEffect(() => {
    if (!shouldAnimatePlaceholder) {
      setAnimatedText('')
      setIsDeleting(false)
      setIsPaused(false)
      return
    }

    const phrases = animatedPlaceholders
    const current = phrases[animatedIndex % phrases.length]
    const timeout = isPaused ? 1400 : isDeleting ? 60 : 110

    const timer = setTimeout(() => {
      if (isPaused) {
        setIsPaused(false)
        setIsDeleting(true)
        return
      }

      if (!isDeleting) {
        const nextText = current.slice(0, animatedText.length + 1)
        setAnimatedText(nextText)
        if (nextText === current) {
          setIsPaused(true)
        }
        return
      }

      const nextText = current.slice(0, Math.max(0, animatedText.length - 1))
      setAnimatedText(nextText)
      if (nextText.length === 0) {
        setIsDeleting(false)
        setAnimatedIndex((prev) => (prev + 1) % phrases.length)
      }
    }, timeout)

    return () => clearTimeout(timer)
  }, [animatedText, animatedIndex, animatedPlaceholders, isDeleting, isPaused, shouldAnimatePlaceholder])

  // Keyboard navigation for search results
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const totalOptions = searchResults.length + 1 + (onQuickAdd ? 1 : 0) // results + AI help + quick add

  // Reset selection when dropdown opens/closes or value changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [showDropdown, value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle escape to close dropdown (but don't clear input)
    if (e.key === 'Escape') {
      if (showDropdown) {
        e.preventDefault()
        e.stopPropagation()
        setFocused(false)
        setSelectedIndex(-1)
        return
      }
      return
    }

    if (e.key === 'Enter' && !showDropdown) {
      if (!value.trim()) return
      e.preventDefault()
      onSubmit(value.trim())
      setValue('')
      setFocused(false)
      return
    }

    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % totalOptions)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions)
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      // Determine which option is selected
      if (selectedIndex < searchResults.length) {
        // Search result
        handleSelectResult(searchResults[selectedIndex])
      } else if (selectedIndex === searchResults.length) {
        // AI help
        handleSubmit(e)
      } else if (selectedIndex === searchResults.length + 1 && onQuickAdd) {
        // Quick add
        handleQuickAdd()
      }
    }
  }

  const effectivePlaceholder = shouldAnimatePlaceholder
    ? (animatedText || animatedPlaceholders[animatedIndex % animatedPlaceholders.length] || placeholder)
    : placeholder

  const combinedInputWrapperClassName = inputWrapperClassName

  return (
    <div ref={containerRef} className={`mb-6 ${containerClassName}`}>
      <form onSubmit={handleSubmit}>
        <div
          className={`
            flex items-center flex-wrap gap-2 bg-elevated
            border rounded-xl px-4
            transition-all duration-200 ease-out
            main-input-wrapper
            ${focused
              ? 'border-border-focus shadow-[0_0_0_4px_var(--accent-soft),0_4px_20px_rgba(0,0,0,0.08)] scale-[1.01]'
              : 'border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]'
            }
            ${combinedInputWrapperClassName}
          `}
          style={{ padding: hasContext ? '10px 16px' : '16px' }}
        >
          {/* Context tags */}
          {visibleTagEntries.map(({ tag, index }) => (
            <div
              key={index}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium
                ${tag.type === 'task' ? 'bg-accent-soft text-accent-text' : 'bg-success-soft text-success'}
              `}
            >
              <span>
                {tag.label.length > 20 ? tag.label.slice(0, 20) + '...' : tag.label}
              </span>
              {onRemoveTag && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveTag(index)
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 tap-target btn-press"
                >
                  <svg width={8} height={8} viewBox="0 0 8 8">
                    <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={hasContext ? content.placeholders.taskStepContext : effectivePlaceholder}
            className={`
              flex-1 min-w-[120px] border-none outline-none
              bg-transparent text-text
              ${hasContext ? 'text-base' : 'text-lg'}
              focus-visible:outline-none focus-visible:ring-0
            `}
          />

          {value && (
            <button
              type="submit"
              className="p-2 text-accent hover:text-accent-text transition-colors btn-press tap-target"
            >
              <svg width={hasContext ? 18 : 20} height={hasContext ? 18 : 20} viewBox="0 0 24 24">
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="mt-1.5 bg-card border border-border-subtle rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] overflow-hidden animate-fade-in"
        >
          {/* Search results */}
          {searchResults.map((r, i) => (
            <div
              key={i}
              onClick={() => handleSelectResult(r)}
              className={`px-4 py-3 min-h-[44px] flex items-center gap-3 cursor-pointer transition-colors animate-rise ${
                selectedIndex === i ? 'bg-card-hover' : 'hover:bg-card-hover'
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="w-6 h-6 rounded-md bg-subtle flex items-center justify-center">
                {r.type === 'task' ? (
                  <svg width={12} height={12} viewBox="0 0 16 16" className="text-text-muted">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                ) : (
                  <div className="w-2 h-2 rounded-full border-[1.5px] border-text-muted" />
                )}
              </div>
              <div>
                <div className="text-sm">
                  {highlightMatch(r.type === 'task' ? r.task.title : r.step!.text, value)}
                </div>
                {r.type === 'step' && (
                  <div className="text-xs text-text-muted">in {r.task.title}</div>
                )}
              </div>
            </div>
          ))}

          {searchResults.length > 0 && <div className="h-px bg-border-subtle" />}

          {/* AI help option */}
          <div
            onClick={handleSubmit}
            className={`px-4 py-3 min-h-[44px] flex items-center gap-3 cursor-pointer transition-colors animate-rise ${
              selectedIndex === searchResults.length ? 'bg-card-hover' : 'hover:bg-card-hover'
            }`}
            style={{ animationDelay: `${searchResults.length * 40}ms` }}
          >
            <div className="w-6 h-6 rounded-md bg-accent-soft flex items-center justify-center">
              <svg width={12} height={12} viewBox="0 0 16 16" className="text-accent">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M8 5V8.5L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm">Help me with "{value}"</div>
              <div className="text-xs text-text-muted">AI breakdown</div>
            </div>
          </div>

          {/* Quick add option */}
          {onQuickAdd && (
            <div
              onClick={handleQuickAdd}
              className={`px-4 py-3 min-h-[44px] flex items-center gap-3 cursor-pointer transition-colors animate-rise ${
                selectedIndex === searchResults.length + 1 ? 'bg-card-hover' : 'hover:bg-card-hover'
              }`}
              style={{ animationDelay: `${(searchResults.length + 1) * 40}ms` }}
            >
              <div className="w-6 h-6 rounded-md bg-success-soft flex items-center justify-center">
                <svg width={12} height={12} viewBox="0 0 16 16" className="text-success">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-sm">Add "{value}"</div>
                <div className="text-xs text-text-muted">Quick add</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
