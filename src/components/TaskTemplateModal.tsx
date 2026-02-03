'use client'

import { useState } from 'react'
import { taskTemplates, templateCategories, getTemplatesByCategory, TaskTemplate } from '@/lib/templates'

interface TaskTemplateModalProps {
  onSelect: (template: TaskTemplate) => void
  onClose: () => void
}

export function TaskTemplateModal({ onSelect, onClose }: TaskTemplateModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)

  // Templates to show based on selected category
  const visibleTemplates = selectedCategory
    ? getTemplatesByCategory(selectedCategory)
    : taskTemplates

  const handleTemplateClick = (template: TaskTemplate) => {
    if (selectedTemplate?.id === template.id) {
      // Double click or second tap - use the template
      onSelect(template)
    } else {
      // First click - show preview
      setSelectedTemplate(template)
    }
  }

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-10 bg-elevated border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl mx-0 sm:mx-4 shadow-modal animate-rise max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text">Task Templates</h2>
            <p className="text-sm text-text-muted mt-0.5">Pre-built steps for common tasks</p>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Close"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 p-3 border-b border-border overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`
              px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${selectedCategory === null
                ? 'bg-accent text-white'
                : 'bg-surface text-text-soft hover:bg-surface/80'
              }
            `}
          >
            All
          </button>
          {templateCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5
                ${selectedCategory === cat.id
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-soft hover:bg-surface/80'
                }
              `}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid gap-2">
            {visibleTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                className={`
                  w-full text-left p-3 rounded-xl transition-all
                  ${selectedTemplate?.id === template.id
                    ? 'bg-accent-soft border-2 border-accent'
                    : 'bg-surface border border-border hover:border-accent/50'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text">{template.title}</div>
                    <div className="text-sm text-text-muted mt-0.5">{template.description}</div>
                    <div className="text-xs text-text-muted mt-1">
                      {template.steps.length} steps
                    </div>
                  </div>
                  {selectedTemplate?.id === template.id && (
                    <div className="text-accent">
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview panel (when template selected) */}
        {selectedTemplate && (
          <div className="border-t border-border p-4 bg-surface/50">
            <div className="text-sm font-medium text-text-soft mb-2">Preview steps:</div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {selectedTemplate.steps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-2 text-sm">
                  <span className="text-text-muted min-w-[20px]">{idx + 1}.</span>
                  <span className="text-text-soft">{step.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleUseTemplate}
              className="mt-3 w-full py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
            >
              Use this template
            </button>
          </div>
        )}

        {/* Tip at bottom if no template selected */}
        {!selectedTemplate && (
          <div className="p-3 border-t border-border">
            <p className="text-xs text-text-muted text-center">
              Tap a template to preview, then tap again or press &ldquo;Use this template&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
