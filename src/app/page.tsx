'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useHabits, useSoulActivities, useTasks, useZoneTasks, Task, ClarifyingAnswer } from '@/hooks/useUserData'
import { LoginPage } from '@/components/LoginPage'
import { Tabs } from '@/components/Tabs'
import { TodayPanel } from '@/components/TodayPanel'
import { SoulPanel } from '@/components/SoulPanel'
import { TasksPanel } from '@/components/TasksPanel'
import { MoneyPanel } from '@/components/MoneyPanel'
import { SpacePanel } from '@/components/SpacePanel'
import { AIChatModal } from '@/components/AIChatModal'
import { EmailModal } from '@/components/EmailModal'
import { ThemeToggle } from '@/components/ThemeProvider'
import { emailTemplates, taskContexts } from '@/lib/emailTemplates'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'soul', label: 'Soul' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'money', label: 'Money' },
  { id: 'space', label: 'Space' },
]

// Demo data for preview mode
const DEMO_HABITS = [
  { id: 'd1', name: 'Make bed', category: 'morning' as const, description: null, link: null, sort_order: 1 },
  { id: 'd2', name: 'Drink water', category: 'morning' as const, description: null, link: null, sort_order: 2 },
  { id: 'd3', name: 'Wordle', category: 'games' as const, description: null, link: 'https://www.nytimes.com/games/wordle', sort_order: 1 },
  { id: 'd4', name: 'Read for 10 min', category: 'optional' as const, description: null, link: null, sort_order: 1 },
]

const DEMO_ACTIVITIES = [
  { id: 'a1', name: 'Call someone you love', icon: '📞', icon_color: 'var(--accent-soft)', default_text: null, sort_order: 1 },
  { id: 'a2', name: 'Go outside', icon: '🚶', icon_color: 'var(--success-soft)', default_text: null, sort_order: 2 },
  { id: 'a3', name: 'Make something', icon: '🎨', icon_color: 'var(--accent-soft)', default_text: null, sort_order: 3 },
]

const DEMO_TASKS: Task[] = [
  { id: 't1', title: 'Schedule dentist appointment', description: 'Been putting this off...', category: 'soon', badge: 'Health', due_date: null, context: {}, actions: [], subtasks: [], notes: null },
  { id: 't2', title: 'Reply to Mom', description: null, category: 'urgent', badge: 'Today', due_date: null, context: {}, actions: [], subtasks: [], notes: null },
]

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { habits, completedHabits, toggleHabit, addHabit, loading: habitsLoading } = useHabits(user)
  const { activities, lastCompleted, logActivity, addActivity, loading: soulLoading } = useSoulActivities(user)
  const { tasks, addTask, updateTask, completeTask, loading: tasksLoading } = useTasks(user)
  const { zoneTasks, toggleZoneTask, loading: zoneLoading } = useZoneTasks(user)

  const [activeTab, setActiveTab] = useState('tasks') // Default to tasks tab for new design
  const [demoMode, setDemoMode] = useState(false)
  const [demoCompleted, setDemoCompleted] = useState<Record<string, boolean>>({ d1: true })
  const [demoTasks, setDemoTasks] = useState(DEMO_TASKS)

  // Modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailProvider, setEmailProvider] = useState<keyof typeof emailTemplates>('vituity')
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [aiChatContext, setAiChatContext] = useState({ title: '', context: '' })

  // Modal handlers
  const openEmailModal = (provider: string) => {
    if (emailTemplates[provider as keyof typeof emailTemplates]) {
      setEmailProvider(provider as keyof typeof emailTemplates)
      setEmailModalOpen(true)
    }
  }

  const openAIChat = (contextKey: string) => {
    const context = taskContexts[contextKey as keyof typeof taskContexts] || contextKey
    setAiChatContext({
      title: `Help with this task`,
      context,
    })
    setAiChatOpen(true)
  }

  // Loading state
  const isLoading = authLoading || (user && (habitsLoading || soulLoading || tasksLoading || zoneLoading))

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text mb-4">Gather</h1>
          <div className="flex justify-center gap-1">
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
          </div>
        </div>
      </div>
    )
  }

  // Not logged in - show login page (unless demo mode)
  if (!user && !demoMode) {
    return <LoginPage onTryDemo={() => setDemoMode(true)} />
  }

  // Use demo data or real data
  const displayHabits = demoMode ? DEMO_HABITS : habits
  const displayCompleted = demoMode ? demoCompleted : completedHabits
  const displayActivities = demoMode ? DEMO_ACTIVITIES : activities
  const displayLastCompleted = demoMode ? {} : lastCompleted
  const displayTasks = demoMode ? demoTasks : tasks
  const displayZoneTasks = demoMode ? {} : zoneTasks

  const handleToggleHabit = demoMode
    ? (id: string) => setDemoCompleted(prev => ({ ...prev, [id]: !prev[id] }))
    : toggleHabit

  const handleLogActivity = demoMode ? () => {} : logActivity
  const handleAddHabit = demoMode ? () => {} : addHabit
  const handleAddActivity = demoMode ? () => {} : addActivity
  const handleAddTask = demoMode
    ? async (title: string, category: 'urgent' | 'soon' | 'waiting', description?: string, badge?: string, clarifyingAnswers?: ClarifyingAnswer[], taskCategory?: string): Promise<Task> => {
        const newTask: Task = {
          id: `demo-${Date.now()}`,
          title,
          description: description || null,
          category,
          badge: badge || null,
          due_date: null,
          context: {},
          actions: [],
          subtasks: [],
          notes: null,
          clarifying_answers: clarifyingAnswers || [],
          task_category: taskCategory,
        }
        setDemoTasks(prev => [...prev, newTask])
        return newTask
      }
    : addTask
  const handleUpdateTask = demoMode
    ? async (taskId: string, updates: Partial<Task>) => {
        setDemoTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
        return { success: true }
      }
    : updateTask
  const handleCompleteTask = demoMode ? () => {} : completeTask
  const handleToggleZone = demoMode ? () => {} : toggleZoneTask

  // Logged in - show main app
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[540px] mx-auto px-6 pt-6 pb-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-text">Gather</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {demoMode ? (
              <button
                onClick={() => setDemoMode(false)}
                className="text-sm text-text-muted hover:text-text transition-colors"
              >
                Sign in
              </button>
            ) : (
              <button
                onClick={signOut}
                className="text-sm text-text-muted hover:text-text transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        {/* Tabs */}
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Panels */}
        {activeTab === 'today' && (
          <TodayPanel
            habits={displayHabits}
            completedHabits={displayCompleted}
            onToggleHabit={handleToggleHabit}
            onAddHabit={handleAddHabit}
          />
        )}
        {activeTab === 'soul' && (
          <SoulPanel
            activities={displayActivities}
            lastCompleted={displayLastCompleted}
            onLogActivity={handleLogActivity}
            onAddActivity={handleAddActivity}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksPanel
            tasks={displayTasks}
            onOpenEmail={openEmailModal}
            onOpenAIChat={openAIChat}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onCompleteTask={handleCompleteTask}
          />
        )}
        {activeTab === 'money' && <MoneyPanel />}
        {activeTab === 'space' && (
          <SpacePanel zoneTasks={displayZoneTasks} onToggleTask={handleToggleZone} />
        )}

        {/* Modals */}
        <EmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          title={`Email to ${emailProvider.charAt(0).toUpperCase() + emailProvider.slice(1)}`}
          template={emailTemplates[emailProvider]}
        />

        <AIChatModal
          isOpen={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
          title={aiChatContext.title}
          context={aiChatContext.context}
        />
      </div>
    </div>
  )
}
