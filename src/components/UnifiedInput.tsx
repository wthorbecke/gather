'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { TaskType } from '@/lib/constants'
import { parseTypePrefix, getTaskTypeLabel, getTaskTypeColor } from '@/lib/taskTypes'
import { parseTime, formatPreviewTime } from '@/lib/timeParser'
import { parseNaturalDate, formatParsedDate } from '@/lib/dateParser'
import { content } from '@/config/content'

// Custom hook for debouncing values
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

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

// Metadata from parsed input (type prefix, time, and due date)
export interface ParsedInputMetadata {
  type: string
  scheduledAt: Date | null
  dueDate: Date | null  // For tasks with "by tomorrow", "due Friday", etc.
}

interface UnifiedInputProps {
  tasks: Task[]
  contextTags?: ContextTag[]
  onSubmit: (value: string, metadata?: ParsedInputMetadata) => void
  onQuickAdd?: (value: string, metadata?: ParsedInputMetadata) => void
  onSelectResult?: (result: SearchResult) => void
  onRemoveTag?: (index: number) => void
  onOpenTemplates?: () => void // Open template picker (/t command)
  placeholder?: string
  allowDropdown?: boolean
  autoFocus?: boolean
  animatedPlaceholders?: string[]
  containerClassName?: string
  inputWrapperClassName?: string
  suggestions?: string[] // Quick reply suggestions to show as autocomplete
  defaultValue?: string // Pre-fill value (e.g., from saved preferences)
  defaultSubmitValue?: string // Value to submit when input is empty (e.g., saved answer)
}

export function UnifiedInput({
  tasks,
  contextTags = [],
  onSubmit,
  onQuickAdd,
  onSelectResult,
  onRemoveTag,
  onOpenTemplates,
  placeholder = content.placeholders.homeInput,
  allowDropdown = true,
  autoFocus = false,
  animatedPlaceholders = [],
  containerClassName = '',
  inputWrapperClassName = '',
  suggestions = [],
  defaultValue,
  defaultSubmitValue,
}: UnifiedInputProps) {
  const hasContext = contextTags.length > 0
  const stepTagIndex = contextTags.findIndex((tag) => tag.type === 'step')
  const stepTag = stepTagIndex >= 0 ? contextTags[stepTagIndex] : null
  const visibleTagEntries = contextTags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => (stepTag ? tag.type !== 'step' : true))

  const [value, setValue] = useState(defaultValue || '')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Typewriter animation state - stored in refs to avoid React re-renders
  const animationRef = useRef({
    text: '',
    phraseIndex: 0,
    isDeleting: false,
    isPaused: false,
    focusText: '',
    timerId: null as NodeJS.Timeout | null,
  })

  // Update value when defaultValue changes (e.g., new question with saved preference)
  // Clear to empty string when defaultValue becomes undefined (e.g., moving to next question)
  useEffect(() => {
    setValue(defaultValue || '')
  }, [defaultValue])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ⌘K keyboard shortcut to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  // Debounce search query to avoid expensive search on every keystroke
  const debouncedSearchQuery = useDebouncedValue(value, 150)

  // Search results - uses debounced value to reduce computation
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = debouncedSearchQuery.toLowerCase().trim()
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
  }, [debouncedSearchQuery, tasks])

  // Filter suggestions that match what user is typing
  const matchingSuggestions = useMemo(() => {
    const q = value.toLowerCase().trim()
    if (!q || suggestions.length === 0) return []
    return suggestions.filter(s =>
      s.toLowerCase().includes(q)
    ).slice(0, 4)
  }, [value, suggestions])

  // Parse type prefix, time, and due date from input
  const parsedInput = useMemo(() => {
    if (!value.trim()) return null

    const { type, cleanText } = parseTypePrefix(value)

    // For reminders and events, also parse time
    if (type === TaskType.REMINDER || type === TaskType.EVENT) {
      const { scheduledAt, cleanText: titleText } = parseTime(cleanText)
      return {
        type,
        title: titleText,
        scheduledAt,
        dueDate: null,
        previewText: scheduledAt ? formatPreviewTime(scheduledAt) : null,
        dueDateText: null,
        hasPrefix: true, // Always true for reminders and events
      }
    }

    // For regular tasks and habits, try to parse due date
    const { date: dueDate, cleanedText: titleText, matchedText } = parseNaturalDate(cleanText)
    return {
      type,
      title: titleText,
      scheduledAt: null,
      dueDate,
      previewText: null,
      dueDateText: dueDate ? `Due ${formatParsedDate(dueDate)}` : null,
      hasPrefix: type !== TaskType.TASK || dueDate !== null, // True if type prefix or date detected
    }
  }, [value])

  // Show type badge when prefix detected (not for regular tasks)
  const showTypeBadge = parsedInput?.hasPrefix && parsedInput.type !== TaskType.TASK

  // Show due date badge when date detected in regular tasks
  const showDueDateBadge = parsedInput?.dueDate && parsedInput.type === TaskType.TASK

  const handleQuickAdd = () => {
    if (!value.trim() || !onQuickAdd) return

    // Pass parsed metadata if we have a type prefix or detected date
    const metadata = parsedInput?.hasPrefix ? {
      type: parsedInput.type,
      scheduledAt: parsedInput.scheduledAt,
      dueDate: parsedInput.dueDate,
    } : undefined

    // Use clean title if we parsed a prefix or date, otherwise use raw value
    const finalValue = parsedInput?.hasPrefix && parsedInput.title ? parsedInput.title : value.trim()
    onQuickAdd(finalValue, metadata)
    setValue('')
    setFocused(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitValue = value.trim() || defaultSubmitValue
    if (!submitValue) return

    // Handle /t command to open template picker
    if (onOpenTemplates && (submitValue === '/t' || submitValue.toLowerCase().startsWith('/t '))) {
      setValue('')
      onOpenTemplates()
      return
    }

    // If type prefix detected and quick add is available, use quick add instead
    // This ensures /e, /r, /h prefixes create tasks directly with the right type
    if (parsedInput?.hasPrefix && onQuickAdd) {
      handleQuickAdd()
      return
    }

    // Pass parsed metadata if we have a type prefix or date (fallback if no onQuickAdd)
    const metadata = parsedInput?.hasPrefix ? {
      type: parsedInput.type,
      scheduledAt: parsedInput.scheduledAt,
      dueDate: parsedInput.dueDate,
    } : undefined

    // Use clean title if we parsed a prefix, otherwise use raw value
    const finalValue = parsedInput?.hasPrefix && parsedInput.title ? parsedInput.title : submitValue
    onSubmit(finalValue, metadata)
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

  const showDropdown = (allowDropdown && focused && value.trim()) || (focused && matchingSuggestions.length > 0)

  const shouldAnimatePlaceholder =
    animatedPlaceholders.length > 0 && !focused && !value && !hasContext

  // Typewriter effect for placeholder when focused
  const shouldAnimateFocusPlaceholder = focused && !value && !hasContext

  // Unified typewriter effect - uses refs + direct DOM updates to avoid React re-renders
  // This replaces two separate effects that were calling setState every 40-80ms
  useEffect(() => {
    const anim = animationRef.current

    // Clear any existing timer
    if (anim.timerId) {
      clearTimeout(anim.timerId)
      anim.timerId = null
    }

    // Reset animation state when conditions change
    if (!shouldAnimatePlaceholder && !shouldAnimateFocusPlaceholder) {
      anim.text = ''
      anim.focusText = ''
      anim.isDeleting = false
      anim.isPaused = false
      // Reset placeholder to default
      if (inputRef.current) {
        inputRef.current.placeholder = hasContext ? content.placeholders.taskStepContext : placeholder
      }
      return
    }

    // Focus placeholder typewriter (simpler - just types once)
    if (shouldAnimateFocusPlaceholder) {
      const targetText = placeholder

      const typeFocusChar = () => {
        if (!inputRef.current) return
        if (anim.focusText.length >= targetText.length) return // Done

        anim.focusText = targetText.slice(0, anim.focusText.length + 1)
        inputRef.current.placeholder = anim.focusText

        anim.timerId = setTimeout(typeFocusChar, 80)
      }

      // Start from current position
      anim.timerId = setTimeout(typeFocusChar, 80)
      return () => {
        if (anim.timerId) clearTimeout(anim.timerId)
      }
    }

    // Cycling placeholder typewriter (types, pauses, deletes, moves to next phrase)
    if (shouldAnimatePlaceholder) {
      const phrases = animatedPlaceholders

      const animate = () => {
        if (!inputRef.current) return

        const current = phrases[anim.phraseIndex % phrases.length]

        if (anim.isPaused) {
          // After pause, start deleting
          anim.isPaused = false
          anim.isDeleting = true
          anim.timerId = setTimeout(animate, 40)
          return
        }

        if (!anim.isDeleting) {
          // Typing forward
          const nextText = current.slice(0, anim.text.length + 1)
          anim.text = nextText
          inputRef.current.placeholder = nextText

          if (nextText === current) {
            // Finished typing, pause before deleting
            anim.isPaused = true
            anim.timerId = setTimeout(animate, 3000)
          } else {
            anim.timerId = setTimeout(animate, 80)
          }
          return
        }

        // Deleting backward
        const nextText = current.slice(0, Math.max(0, anim.text.length - 1))
        anim.text = nextText
        inputRef.current.placeholder = nextText || phrases[(anim.phraseIndex + 1) % phrases.length].charAt(0)

        if (nextText.length === 0) {
          // Finished deleting, move to next phrase
          anim.isDeleting = false
          anim.phraseIndex = (anim.phraseIndex + 1) % phrases.length
        }

        anim.timerId = setTimeout(animate, 40)
      }

      // Start animation
      anim.timerId = setTimeout(animate, 80)
      return () => {
        if (anim.timerId) clearTimeout(anim.timerId)
      }
    }
  }, [shouldAnimatePlaceholder, shouldAnimateFocusPlaceholder, animatedPlaceholders, placeholder, hasContext])

  // Keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  // Total options: suggestions + search results + AI help + quick add
  const showAIHelp = allowDropdown && value.trim()
  const totalOptions = matchingSuggestions.length + searchResults.length + (showAIHelp ? 1 : 0) + (onQuickAdd && showAIHelp ? 1 : 0)

  useEffect(() => {
    setSelectedIndex(-1)
  }, [showDropdown, value])

  const handleSelectSuggestion = (suggestion: string) => {
    onSubmit(suggestion)
    setValue('')
    setFocused(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setFocused(false)
      setSelectedIndex(-1)
      inputRef.current?.blur()
      return
    }

    if (e.key === 'Enter' && !showDropdown) {
      const submitValue = value.trim() || defaultSubmitValue
      if (!submitValue) return
      e.preventDefault()

      // Handle /t command to open template picker
      if (onOpenTemplates && (submitValue === '/t' || submitValue.toLowerCase().startsWith('/t '))) {
        setValue('')
        setFocused(false)
        onOpenTemplates()
        return
      }

      // If type prefix detected and quick add is available, use quick add
      if (parsedInput?.hasPrefix && onQuickAdd) {
        handleQuickAdd()
        return
      }

      onSubmit(submitValue)
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
      // Order: suggestions -> search results -> AI help -> quick add
      if (selectedIndex < matchingSuggestions.length) {
        handleSelectSuggestion(matchingSuggestions[selectedIndex])
      } else if (selectedIndex < matchingSuggestions.length + searchResults.length) {
        handleSelectResult(searchResults[selectedIndex - matchingSuggestions.length])
      } else if (selectedIndex === matchingSuggestions.length + searchResults.length && showAIHelp) {
        handleSubmit(e)
      } else if (onQuickAdd && showAIHelp) {
        handleQuickAdd()
      }
    }
  }

  // Placeholder is now updated directly via inputRef in the animation effect
  // Initial placeholder is shown before animation starts, then DOM updates take over
  const effectivePlaceholder = shouldAnimatePlaceholder
    ? (animatedPlaceholders[0] || placeholder)
    : placeholder

  // Show keyboard shortcut hint when input is not focused
  const showShortcutHint = !focused
  const showBreathing = !focused && !value && !hasContext && tasks.length === 0

  return (
    <div ref={containerRef} className={`mb-6 ${containerClassName}`}>
      <form onSubmit={handleSubmit}>
        <div
          onClick={() => inputRef.current?.focus()}
          className={`
            flex items-center gap-2 px-4 py-3 cursor-text
            bg-card rounded-md
            border transition-[border-color,box-shadow] duration-200
            ${focused ? 'border-border-focus input-focused' : 'border-border-subtle'}
            ${inputWrapperClassName}
            ${showBreathing ? 'input-breathing' : ''}
          `}
          style={{
            boxShadow: showBreathing
              ? undefined // Let CSS animation handle it
              : 'var(--shadow-sm)',
          }}
        >
          {/* Context tags */}
          {visibleTagEntries.map(({ tag, index }) => (
            <div
              key={index}
              className={`
                flex items-center gap-1.5
                px-2.5 py-1 rounded-sm
                text-sm font-medium flex-shrink-0
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
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 tap-target btn-press"
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
              flex-1 min-w-[120px] py-1
              border-none outline-none
              bg-transparent text-text text-lg font-normal
              focus-visible:outline-none focus-visible:ring-0
              placeholder:text-text-muted placeholder:font-normal
            `}
          />

          {/* Keyboard shortcut hint - show when not focused */}
          {showShortcutHint && (
            <div className="flex items-center gap-1 text-text-muted text-xs flex-shrink-0">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-medium">⌘</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-medium">K</kbd>
            </div>
          )}

          {/* Type badge when prefix detected */}
          {showTypeBadge && parsedInput && (
            <div className={`
              px-2 py-0.5 rounded-sm text-xs font-medium flex-shrink-0
              ${parsedInput.type === TaskType.REMINDER ? 'bg-accent-soft text-accent' : ''}
              ${parsedInput.type === TaskType.HABIT ? 'bg-success-soft text-success' : ''}
              ${parsedInput.type === TaskType.EVENT ? 'bg-subtle text-text-soft' : ''}
            `}>
              {getTaskTypeLabel(parsedInput.type)}
            </div>
          )}

          {/* Due date badge when date detected in input */}
          {showDueDateBadge && parsedInput?.dueDateText && (
            <div className="px-2 py-0.5 rounded-sm text-xs font-medium flex-shrink-0 bg-accent/10 text-accent flex items-center gap-1">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {parsedInput.dueDateText}
            </div>
          )}

          {/* Return icon when focused - show when there's content or a default submit value */}
          {focused && (value.trim() || defaultSubmitValue) && (
            <button
              type="submit"
              className="p-2 -m-0.5 rounded-md flex-shrink-0 text-text-muted hover:text-text-soft cursor-pointer transition-colors duration-[80ms]"
              aria-label="Submit"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 10l-5 5 5 5" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Preview of parsed input when type prefix detected */}
        {showTypeBadge && parsedInput && parsedInput.title && (
          <div className="mt-2 px-1 text-xs text-text-muted">
            <span className={getTaskTypeColor(parsedInput.type)}>{getTaskTypeLabel(parsedInput.type)}:</span>
            {' '}{parsedInput.title}
            {parsedInput.previewText && (
              <span className="text-accent"> · {parsedInput.previewText}</span>
            )}
          </div>
        )}
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className="mt-1.5 bg-card border border-border rounded-md shadow-md overflow-hidden animate-fade-in">
          {/* Matching suggestions (autocomplete from quick replies) */}
          {matchingSuggestions.map((suggestion, i) => (
            <div
              key={`suggestion-${i}`}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`
                px-4 py-3 min-h-[44px]
                flex items-center gap-3
                cursor-pointer transition-colors duration-[80ms]
                animate-rise
                ${selectedIndex === i ? 'bg-card-hover' : 'hover:bg-card-hover'}
              `}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="w-6 h-6 rounded-sm bg-accent-soft flex items-center justify-center">
                <svg width={12} height={12} viewBox="0 0 16 16" className="text-accent">
                  <path d="M8 2L8 14M2 8L14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  <circle cx="8" cy="8" r="3" fill="currentColor" />
                </svg>
              </div>
              <div className="text-sm">{highlightMatch(suggestion, value)}</div>
            </div>
          ))}

          {matchingSuggestions.length > 0 && (searchResults.length > 0 || showAIHelp) && (
            <div className="h-px bg-border" />
          )}

          {/* Search results */}
          {searchResults.map((r, i) => (
            <div
              key={`result-${i}`}
              onClick={() => handleSelectResult(r)}
              className={`
                px-4 py-3 min-h-[44px]
                flex items-center gap-3
                cursor-pointer transition-colors duration-[80ms]
                animate-rise
                ${selectedIndex === matchingSuggestions.length + i ? 'bg-card-hover' : 'hover:bg-card-hover'}
              `}
              style={{ animationDelay: `${(matchingSuggestions.length + i) * 40}ms` }}
            >
              <div className="w-6 h-6 rounded-sm bg-subtle flex items-center justify-center">
                {r.type === 'task' ? (
                  <svg width={12} height={12} viewBox="0 0 16 16" className="text-text-muted">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                ) : (
                  <div className="w-2 h-2 rounded-full border-[1.5px] border-text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">
                  {highlightMatch(r.type === 'task' ? r.task.title : r.step!.text, value)}
                </div>
                {r.type === 'step' && (
                  <div className="text-xs text-text-muted truncate">in {r.task.title}</div>
                )}
              </div>
            </div>
          ))}

          {searchResults.length > 0 && showAIHelp && <div className="h-px bg-border" />}

          {/* AI help option */}
          {showAIHelp && (
            <div
              onClick={handleSubmit}
              className={`
                px-4 py-3 min-h-[44px]
                flex items-center gap-3
                cursor-pointer transition-colors duration-[80ms]
                animate-rise
                ${selectedIndex === matchingSuggestions.length + searchResults.length ? 'bg-card-hover' : 'hover:bg-card-hover'}
              `}
              style={{ animationDelay: `${(matchingSuggestions.length + searchResults.length) * 40}ms` }}
            >
              <div className="w-6 h-6 rounded-sm bg-accent-soft flex items-center justify-center">
                <svg width={12} height={12} viewBox="0 0 16 16" className="text-accent">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 5V8.5L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-sm">Help me with &ldquo;{value}&rdquo;</div>
                <div className="text-xs text-text-muted">AI breakdown</div>
              </div>
            </div>
          )}

          {/* Quick add option */}
          {onQuickAdd && showAIHelp && (
            <div
              onClick={handleQuickAdd}
              className={`
                px-4 py-3 min-h-[44px]
                flex items-center gap-3
                cursor-pointer transition-colors duration-[80ms]
                animate-rise
                ${selectedIndex === matchingSuggestions.length + searchResults.length + 1 ? 'bg-card-hover' : 'hover:bg-card-hover'}
              `}
              style={{ animationDelay: `${(matchingSuggestions.length + searchResults.length + 1) * 40}ms` }}
            >
              <div className="w-6 h-6 rounded-sm bg-success-soft flex items-center justify-center">
                <svg width={12} height={12} viewBox="0 0 16 16" className="text-success">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-sm">Add &ldquo;{value}&rdquo;</div>
                <div className="text-xs text-text-muted">Quick add</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
