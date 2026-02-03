'use client'

import { useState, useEffect } from 'react'

interface OnboardingProps {
  isOpen: boolean
  onComplete: () => void
}

const steps = [
  {
    title: "Tasks feel impossible?",
    subtitle: "We get it.",
    description: "Gather uses AI to break down overwhelming tasks into small, specific steps you can actually do.",
    visual: "breakdown", // Will render a task breakdown animation
  },
  {
    title: "It asks the right questions",
    subtitle: "So your steps actually work.",
    description: "Instead of generic advice, the AI asks what you need to make each step specific to your situation.",
    visual: "questions", // Will render question bubbles
  },
  {
    title: "Ready to dump something?",
    subtitle: "Type anything that's on your mind.",
    description: "\"File my taxes\", \"clean the garage\", \"plan mom's birthday\" — whatever's been nagging at you.",
    visual: "input", // Will render the input preview
  },
]

export function Onboarding({ isOpen, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      setCurrentStep(0)
      onComplete()
    }, 250)
  }

  const handleSkip = () => {
    handleComplete()
  }

  if (!isOpen && !isClosing) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm ${
          isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
        }`}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md bg-elevated rounded-2xl overflow-hidden shadow-modal border border-border ${
          isClosing ? 'animate-modal-out' : isVisible ? 'animate-modal-in' : 'opacity-0'
        }`}
      >
        {/* Skip button - min 44x44px touch target per WCAG */}
        {!isLastStep && (
          <button
            onClick={handleSkip}
            className="absolute top-2 right-2 text-sm text-text-muted hover:text-text transition-colors z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            Skip
          </button>
        )}

        {/* Content */}
        <div className="px-6 pt-10 pb-6">
          {/* Visual */}
          <div className="mb-8">
            <OnboardingVisual type={step.visual} />
          </div>

          {/* Text */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-text mb-1">
              {step.title}
            </h2>
            <p className="text-lg text-accent font-medium mb-3">
              {step.subtitle}
            </p>
            <p className="text-text-soft leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentStep
                    ? 'bg-accent w-6'
                    : index < currentStep
                    ? 'bg-accent/50'
                    : 'bg-surface'
                }`}
              />
            ))}
          </div>

          {/* Action button */}
          <button
            onClick={handleNext}
            className="w-full py-3.5 px-6 bg-accent text-white font-medium rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all duration-150"
          >
            {isLastStep ? "Let's go" : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Visual components for each step
function OnboardingVisual({ type }: { type: string }) {
  if (type === 'breakdown') {
    return (
      <div className="bg-surface rounded-xl p-4 space-y-3">
        {/* Original task */}
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-5 h-5 rounded-full border-2 border-text-muted" />
          <span className="text-text font-medium">File my taxes</span>
        </div>
        {/* Broken down steps */}
        <div className="space-y-2 pl-2">
          {[
            'Gather W-2 forms from employer',
            'Download 1099s from bank',
            'Log into TurboTax',
          ].map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm animate-fade-in-up"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="w-4 h-4 rounded border border-success/50 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-text-soft">{step}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'questions') {
    return (
      <div className="space-y-3">
        {/* User message */}
        <div className="flex justify-end">
          <div className="bg-accent/10 text-text px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%]">
            File my taxes
          </div>
        </div>
        {/* AI question */}
        <div className="flex justify-start">
          <div className="bg-surface px-4 py-2 rounded-2xl rounded-tl-sm max-w-[80%] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <span className="text-text-soft">What state do you live in?</span>
          </div>
        </div>
        {/* Quick replies */}
        <div className="flex gap-2 flex-wrap animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          {['California', 'Texas', 'New York'].map((state) => (
            <span
              key={state}
              className="px-3 py-1.5 bg-surface border border-border rounded-full text-sm text-text-soft"
            >
              {state}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'input') {
    return (
      <div className="bg-surface rounded-xl p-4">
        <div className="flex items-center gap-3 text-text-muted">
          <span className="text-lg">What&apos;s on your mind?</span>
          <span className="animate-pulse">|</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['file taxes', 'clean garage', 'plan trip'].map((example) => (
            <span
              key={example}
              className="px-3 py-1.5 bg-canvas border border-border-subtle rounded-lg text-sm text-text-muted"
            >
              {example}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return null
}
