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
  contextTags?: ContextTag[]
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
  const [animatedText, setAnimatedText] = useState('')
  const [animatedIndex, setAnimatedIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [focusPlaceholderText, setFocusPlaceholderText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // Filter suggestions that match what user is typing
  const matchingSuggestions = useMemo(() => {
    const q = value.toLowerCase().trim()
    if (!q || suggestions.length === 0) return []
    return suggestions.filter(s =>
      s.toLowerCase().includes(q)
    ).slice(0, 4)
  }, [value, suggestions])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitValue = value.trim() || defaultSubmitValue
    if (!submitValue) return
    onSubmit(submitValue)
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

  const showDropdown = (allowDropdown && focused && value.trim()) || (focused && matchingSuggestions.length > 0)

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
    // Slower, more relaxed typing: 80ms type, 40ms delete, 3s pause
    const timeout = isPaused ? 3000 : isDeleting ? 40 : 80

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

  // Typewriter effect for placeholder when focused
  const shouldAnimateFocusPlaceholder = focused && !value && !hasContext

  useEffect(() => {
    if (!shouldAnimateFocusPlaceholder) {
      setFocusPlaceholderText('')
      return
    }

    const targetText = placeholder
    if (focusPlaceholderText.length >= targetText.length) {
      return // Done typing
    }

    const timer = setTimeout(() => {
      setFocusPlaceholderText(targetText.slice(0, focusPlaceholderText.length + 1))
    }, 80) // Same speed as cycling typewriter

    return () => clearTimeout(timer)
  }, [focusPlaceholderText, shouldAnimateFocusPlaceholder, placeholder])

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

  const effectivePlaceholder = shouldAnimatePlaceholder
    ? (animatedText || animatedPlaceholders[animatedIndex % animatedPlaceholders.length] || placeholder)
    : shouldAnimateFocusPlaceholder
    ? (focusPlaceholderText || '')
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
