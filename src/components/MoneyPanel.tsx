'use client'

import { useState } from 'react'

interface MoneyPanelProps {
  // Future: budget data from database
}

export function MoneyPanel({}: MoneyPanelProps) {
  const [simAmount, setSimAmount] = useState(100)
  const [simType, setSimType] = useState<'cash' | 'monthly'>('cash')
  const [simMonthly, setSimMonthly] = useState(25)
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null)
  const [fixedCosts, setFixedCosts] = useState<number | null>(null)

  // If user hasn't set up their budget, show setup
  const isSetUp = monthlyIncome !== null && fixedCosts !== null
  const flexible = isSetUp ? monthlyIncome! - fixedCosts! : 0

  const getSimResult = () => {
    if (!isSetUp) return null

    if (simType === 'cash') {
      const percent = ((simAmount / flexible) * 100).toFixed(0)
      const weeks = (simAmount / (flexible / 4)).toFixed(1)
      return (
        <>
          A <strong>${simAmount}</strong> purchase is about <strong>{percent}%</strong> of your
          monthly flexible budget. If you saved 25% of your flexible income, you&apos;d have this in
          about <strong>{weeks} weeks</strong>.
        </>
      )
    } else {
      const months = Math.ceil(simAmount / simMonthly)
      const percent = ((simMonthly / flexible) * 100).toFixed(0)
      return (
        <>
          <strong>${simMonthly}/month</strong> for <strong>{months} months</strong>. That&apos;s{' '}
          {percent}% of your flexible budget each month — leaves you{' '}
          <strong>${flexible - simMonthly}</strong> for everything else.
        </>
      )
    }
  }

  // Setup view
  if (!isSetUp) {
    return (
      <div className="animate-fade-in">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-serif text-2xl text-[var(--text)] mb-2">Set up your budget</h2>
            <p className="text-[var(--text-soft)] text-sm">
              Quick setup to understand your spending capacity
            </p>
          </div>

          <div className="bg-white border border-[var(--border-light)] rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-[0.85rem] text-[var(--text)] mb-2">
                Monthly income (after tax)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                <input
                  type="number"
                  placeholder="4,000"
                  className="w-full pl-8 pr-4 py-3 border border-[var(--border)] rounded-xl text-[0.95rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]"
                  onChange={(e) => setMonthlyIncome(Number(e.target.value) || null)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[0.85rem] text-[var(--text)] mb-2">
                Fixed monthly costs (rent, utilities, subscriptions)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                <input
                  type="number"
                  placeholder="2,000"
                  className="w-full pl-8 pr-4 py-3 border border-[var(--border)] rounded-xl text-[0.95rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]"
                  onChange={(e) => setFixedCosts(Number(e.target.value) || null)}
                />
              </div>
            </div>

            {monthlyIncome && fixedCosts && (
              <div className="pt-4 border-t border-[var(--border-light)]">
                <div className="text-center">
                  <div className="text-[0.8rem] text-[var(--text-muted)] mb-1">Your flexible budget</div>
                  <div className="font-serif text-3xl text-[var(--sage)]">
                    ${(monthlyIncome - fixedCosts).toLocaleString()}/mo
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[0.8rem] text-[var(--text-muted)] mt-4 text-center">
            This stays on your device. Full budget tracking coming soon.
          </p>
        </div>
      </div>
    )
  }

  // Main view
  return (
    <div className="animate-fade-in">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Monthly income" value={`$${monthlyIncome?.toLocaleString()}`} positive />
        <StatCard label="Fixed costs" value={`$${fixedCosts?.toLocaleString()}`} />
        <StatCard label="Flexible" value={`$${flexible.toLocaleString()}`} />
        <button
          onClick={() => { setMonthlyIncome(null); setFixedCosts(null) }}
          className="bg-white border border-[var(--border-light)] rounded-2xl p-5 text-center hover:bg-[var(--bg-warm)] transition-colors"
        >
          <div className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Settings
          </div>
          <div className="text-[var(--accent)] text-sm">Edit →</div>
        </button>
      </div>

      {/* Simulator */}
      <div className="bg-white border border-[var(--border-light)] rounded-2xl p-6">
        <h3 className="font-serif text-lg mb-4 text-[var(--text)]">What if I bought...</h3>
        <div className="flex gap-4 flex-wrap mb-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[0.8rem] text-[var(--text-muted)] mb-1.5">Amount</label>
            <input
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[0.8rem] text-[var(--text-muted)] mb-1.5">How</label>
            <select
              value={simType}
              onChange={(e) => setSimType(e.target.value as 'cash' | 'monthly')}
              className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="cash">Pay now</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {simType === 'monthly' && (
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[0.8rem] text-[var(--text-muted)] mb-1.5">Per month</label>
              <input
                type="number"
                value={simMonthly}
                onChange={(e) => setSimMonthly(Number(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}
        </div>
        <div className="bg-[var(--bg-warm)] rounded-xl p-5 text-[0.9rem] text-[var(--text-soft)] leading-relaxed">
          {getSimResult()}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string
  value: string
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="bg-white border border-[var(--border-light)] rounded-2xl p-5 text-center">
      <div className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-wider mb-2">
        {label}
      </div>
      <div
        className={`font-serif text-2xl font-medium ${
          positive ? 'text-[var(--sage)]' : negative ? 'text-[var(--rose)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
