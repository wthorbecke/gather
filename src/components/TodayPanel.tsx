'use client'

import { useState, useMemo } from 'react'
import { HabitItem } from './HabitItem'
import { Habit } from '@/hooks/useUserData'

const QUOTES = [
  { text: "You could leave life right now. Let that determine what you do and say and think.", author: "Marcus Aurelius" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "How we spend our days is, of course, how we spend our lives.", author: "Annie Dillard" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Progress, not perfection.", author: "Unknown" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "The present moment is the only moment available to us, and it is the door to all moments.", author: "Thich Nhat Hanh" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "The most effective way to do it, is to do it.", author: "Amelia Earhart" },
]

interface TodayPanelProps {
  habits: Habit[]
  completedHabits: Record<string, boolean>
  onToggleHabit: (habitId: string) => void
  onAddHabit: (name: string, category: 'morning' | 'games' | 'optional', description?: string, link?: string) => void
}

export function TodayPanel({ habits, completedHabits, onToggleHabit, onAddHabit }: TodayPanelProps) {
  const [addingTo, setAddingTo] = useState<'morning' | 'games' | 'optional' | null>(null)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitDesc, setNewHabitDesc] = useState('')
  const [newHabitLink, setNewHabitLink] = useState('')

  // Pick a random quote on mount (changes on refresh)
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [])

  const morningHabits = habits.filter((h) => h.category === 'morning')
  const gamesHabits = habits.filter((h) => h.category === 'games')
  const optionalHabits = habits.filter((h) => h.category === 'optional')

  const countCompleted = (items: Habit[]) =>
    items.filter((h) => completedHabits[h.id]).length

  const handleAddHabit = (category: 'morning' | 'games' | 'optional') => {
    if (!newHabitName.trim()) return
    onAddHabit(newHabitName.trim(), category, newHabitDesc.trim() || undefined, newHabitLink.trim() || undefined)
    setNewHabitName('')
    setNewHabitDesc('')
    setNewHabitLink('')
    setAddingTo(null)
  }

  const AddHabitForm = ({ category }: { category: 'morning' | 'games' | 'optional' }) => (
    <div className="bg-white border border-[var(--border-light)] rounded-xl p-4 mt-2">
      <input
        type="text"
        value={newHabitName}
        onChange={(e) => setNewHabitName(e.target.value)}
        placeholder="Habit name"
        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)] mb-2"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAddHabit(category)
          if (e.key === 'Escape') setAddingTo(null)
        }}
      />
      <input
        type="text"
        value={newHabitDesc}
        onChange={(e) => setNewHabitDesc(e.target.value)}
        placeholder="Description (optional)"
        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)] mb-2"
      />
      {category === 'games' && (
        <input
          type="text"
          value={newHabitLink}
          onChange={(e) => setNewHabitLink(e.target.value)}
          placeholder="Link (optional)"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[0.9rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)] mb-2"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={() => handleAddHabit(category)}
          className="flex-1 py-2 bg-[var(--text)] text-white rounded-lg text-[0.85rem]"
        >
          Add
        </button>
        <button
          onClick={() => setAddingTo(null)}
          className="px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] rounded-lg text-[0.85rem]"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  // Show empty state if no habits
  if (habits.length === 0 && !addingTo) {
    return (
      <div className="animate-fade-in">
        <div className="text-center p-10 mb-10 bg-gradient-to-br from-[var(--rose-soft)] to-[var(--bg)] rounded-2xl">
          <p className="font-serif text-2xl italic text-[var(--text)] mb-3 leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-[0.8rem] text-[var(--text-muted)] tracking-wider uppercase">
            {quote.author}
          </p>
        </div>
        <div className="text-center py-8">
          <p className="text-[var(--text-soft)] mb-4">No habits set up yet.</p>
          <button
            onClick={() => setAddingTo('morning')}
            className="px-6 py-3 bg-[var(--text)] text-white rounded-xl text-[0.9rem] hover:bg-[var(--text-soft)] transition-colors"
          >
            + Add your first habit
          </button>
        </div>
        {addingTo && <AddHabitForm category={addingTo} />}
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Quote */}
      <div className="text-center p-10 mb-10 bg-gradient-to-br from-[var(--rose-soft)] to-[var(--bg)] rounded-2xl">
        <p className="font-serif text-2xl italic text-[var(--text)] mb-3 leading-relaxed">
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="text-[0.8rem] text-[var(--text-muted)] tracking-wider uppercase">
          {quote.author}
        </p>
      </div>

      {/* Morning */}
      <Section
        title="Morning"
        count={`${countCompleted(morningHabits)} / ${morningHabits.length}`}
        onAdd={() => setAddingTo('morning')}
      >
        <div className="flex flex-col gap-2">
          {morningHabits.map((habit) => (
            <HabitItem
              key={habit.id}
              name={habit.name}
              description={habit.description || undefined}
              link={habit.link || undefined}
              completed={!!completedHabits[habit.id]}
              onToggle={() => onToggleHabit(habit.id)}
            />
          ))}
          {addingTo === 'morning' && <AddHabitForm category="morning" />}
        </div>
      </Section>

      {/* Daily play */}
      <Section
        title="Daily play"
        count={`${countCompleted(gamesHabits)} / ${gamesHabits.length}`}
        onAdd={() => setAddingTo('games')}
      >
        <div className="flex flex-col gap-2">
          {gamesHabits.map((habit) => (
            <HabitItem
              key={habit.id}
              name={habit.name}
              description={habit.description || undefined}
              link={habit.link || undefined}
              completed={!!completedHabits[habit.id]}
              onToggle={() => onToggleHabit(habit.id)}
            />
          ))}
          {addingTo === 'games' && <AddHabitForm category="games" />}
        </div>
      </Section>

      {/* When you can */}
      <Section
        title="When you can"
        count={`${countCompleted(optionalHabits)} / ${optionalHabits.length}`}
        onAdd={() => setAddingTo('optional')}
      >
        <div className="flex flex-col gap-2">
          {optionalHabits.map((habit) => (
            <HabitItem
              key={habit.id}
              name={habit.name}
              description={habit.description || undefined}
              link={habit.link || undefined}
              completed={!!completedHabits[habit.id]}
              onToggle={() => onToggleHabit(habit.id)}
            />
          ))}
          {addingTo === 'optional' && <AddHabitForm category="optional" />}
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  count,
  children,
  onAdd,
}: {
  title: string
  count: string
  children: React.ReactNode
  onAdd: () => void
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-light)]">
        <h2 className="font-serif text-xl font-medium text-[var(--text)]">{title}</h2>
        <span className="text-[0.75rem] text-[var(--text-muted)]">{count}</span>
        <button
          onClick={onAdd}
          className="ml-auto text-[0.8rem] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          + Add
        </button>
      </div>
      {children}
    </div>
  )
}
