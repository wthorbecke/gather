'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import { useSubscription } from '@/hooks/useSubscription'
import { PRICE_MONTHLY, PRICE_YEARLY } from '@/lib/stripe'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [isLoading, setIsLoading] = useState(false)
  const { startCheckout } = useSubscription()

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      await startCheckout(interval)
    } catch (err) {
      console.error('Checkout error:', err)
      setIsLoading(false)
    }
  }

  const monthlyPrice = PRICE_MONTHLY
  const yearlyPrice = PRICE_YEARLY
  const yearlySavings = (monthlyPrice * 12) - yearlyPrice

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="420px" showHeader={false}>
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-text mb-2">Upgrade to Pro</h2>
          <p className="text-text-soft text-sm">
            Get AI-powered task breakdown and proactive reminders
          </p>
        </div>

        {/* Interval Toggle */}
        <div className="flex gap-2 p-1 bg-surface rounded-lg mb-6">
          <button
            onClick={() => setInterval('monthly')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              interval === 'monthly'
                ? 'bg-elevated shadow-sm text-text'
                : 'text-text-soft hover:text-text'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval('yearly')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              interval === 'yearly'
                ? 'bg-elevated shadow-sm text-text'
                : 'text-text-soft hover:text-text'
            }`}
          >
            Yearly
            <span className="ml-1 text-xs text-success">Save ${yearlySavings}</span>
          </button>
        </div>

        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-text">
              ${interval === 'monthly' ? monthlyPrice : Math.round(yearlyPrice / 12)}
            </span>
            <span className="text-text-muted">/month</span>
          </div>
          {interval === 'yearly' && (
            <p className="text-sm text-text-soft mt-1">
              Billed ${yearlyPrice} annually
            </p>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-6">
          <FeatureItem>AI breaks down tasks into doable steps</FeatureItem>
          <FeatureItem>Proactive reminders via push & SMS</FeatureItem>
          <FeatureItem>Gmail scanning for actionable emails</FeatureItem>
          <FeatureItem>Google Calendar integration</FeatureItem>
          <FeatureItem>Deadline-based AI nudges</FeatureItem>
        </ul>

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-accent text-white font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Start Pro'}
        </button>

        {/* Cancel note */}
        <p className="text-center text-xs text-text-muted mt-3">
          Cancel anytime. No questions asked.
        </p>
      </div>
    </Modal>
  )
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-success mt-0.5">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M13.5 4.5L6 12L2.5 8.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-sm text-text">{children}</span>
    </li>
  )
}

// Inline prompt component for use in the app
export function UpgradePrompt({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="p-4 bg-surface rounded-xl border border-border">
      <p className="text-sm text-text mb-3">
        Upgrade to Pro to unlock AI task breakdown and more
      </p>
      <button
        onClick={onUpgrade}
        className="w-full py-2 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all"
      >
        View Plans
      </button>
    </div>
  )
}
