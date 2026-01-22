'use client'

import { useState } from 'react'
import { SoulItem } from './SoulItem'
import { SoulActivity } from '@/hooks/useUserData'

interface SoulPanelProps {
  activities: SoulActivity[]
  lastCompleted: Record<string, number>
  onLogActivity: (activityId: string) => void
  onAddActivity: (name: string, icon: string, defaultText?: string) => void
}

const EMOJI_OPTIONS = ['🎹', '🐱', '🚶', '🍳', '📞', '☕', '👋', '📚', '🎮', '🏃', '🧘', '✍️', '🎨', '🌱', '💪']

export function SoulPanel({ activities, lastCompleted, onLogActivity, onAddActivity }: SoulPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🎯')
  const [newDefaultText, setNewDefaultText] = useState('')

  const handleAdd = () => {
    if (!newName.trim()) return
    onAddActivity(newName.trim(), newIcon, newDefaultText.trim() || undefined)
    setNewName('')
    setNewIcon('🎯')
    setNewDefaultText('')
    setShowAddForm(false)
  }

  // Show empty state if no activities
  if (activities.length === 0 && !showAddForm) {
    return (
      <div className="animate-fade-in">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-light)]">
            <h2 className="font-serif text-xl font-medium text-[var(--text)]">Things that matter</h2>
          </div>
          <p className="text-[0.9rem] text-[var(--text-soft)] mb-6 leading-relaxed">
            These don&apos;t have deadlines. But they&apos;re why you&apos;re doing everything else.
          </p>
          <div className="text-center py-8">
            <p className="text-[var(--text-soft)] mb-4">No soul activities set up yet.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-[var(--text)] text-white rounded-xl text-[0.9rem] hover:bg-[var(--text-soft)] transition-colors"
            >
              + Add something that matters
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-light)]">
          <h2 className="font-serif text-xl font-medium text-[var(--text)]">Things that matter</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="ml-auto text-[0.8rem] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            + Add
          </button>
        </div>
        <p className="text-[0.9rem] text-[var(--text-soft)] mb-6 leading-relaxed">
          These don&apos;t have deadlines. But they&apos;re why you&apos;re doing everything else.
        </p>
        <div className="flex flex-col gap-2">
          {activities.map((activity) => (
            <SoulItem
              key={activity.id}
              name={activity.name}
              icon={activity.icon}
              iconColor={activity.icon_color}
              lastDone={lastCompleted[activity.id] ? new Date(lastCompleted[activity.id]) : undefined}
              defaultText={activity.default_text || "Tap 'Done' when you do"}
              onDone={() => onLogActivity(activity.id)}
            />
          ))}

          {showAddForm && (
            <div className="bg-white border border-[var(--border-light)] rounded-2xl p-5 mt-2">
              <div className="flex gap-3 mb-3">
                <div>
                  <label className="block text-[0.75rem] text-[var(--text-muted)] mb-1">Icon</label>
                  <select
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-16 h-12 text-2xl text-center border border-[var(--border)] rounded-lg bg-[var(--bg)]"
                  >
                    {EMOJI_OPTIONS.map((emoji) => (
                      <option key={emoji} value={emoji}>{emoji}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[0.75rem] text-[var(--text-muted)] mb-1">Activity</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Call Mom"
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdd()
                      if (e.key === 'Escape') setShowAddForm(false)
                    }}
                  />
                </div>
              </div>
              <input
                type="text"
                value={newDefaultText}
                onChange={(e) => setNewDefaultText(e.target.value)}
                placeholder="Reminder text (optional)"
                className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)] mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2.5 bg-[var(--text)] text-white rounded-lg text-[0.85rem]"
                >
                  Add activity
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 border border-[var(--border)] text-[var(--text-muted)] rounded-lg text-[0.85rem]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
