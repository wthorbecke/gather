export interface User {
  id: string
  phone: string
  timezone: string
  created_at: string
}

export interface Habit {
  id: string
  user_id: string
  name: string
  category: 'morning' | 'games' | 'optional'
  description?: string
  link?: string
  created_at: string
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  completed_at: string
  date: string // YYYY-MM-DD
}

export interface SoulActivity {
  id: string
  user_id: string
  name: string
  icon: string
  description?: string
  created_at: string
}

export interface SoulLog {
  id: string
  user_id: string
  activity_id: string
  completed_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  category: 'urgent' | 'soon' | 'waiting' | 'completed'
  due_date?: string
  context?: Record<string, unknown> // Store member IDs, case numbers, etc.
  actions?: TaskAction[]
  created_at: string
  completed_at?: string
}

export interface TaskAction {
  type: 'link' | 'email' | 'phone' | 'ai_help'
  label: string
  url?: string
  email_template?: EmailTemplate
  phone_number?: string
  ai_context?: string
}

export interface EmailTemplate {
  to: string
  subject: string
  body: string
}

export interface SpaceZone {
  id: string
  user_id: string
  name: string
  icon: string
  tasks: SpaceTask[]
}

export interface SpaceTask {
  id: string
  zone_id: string
  name: string
  completed: boolean
}

export interface Message {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  task_context?: string
  created_at: string
}

export interface CheckIn {
  id: string
  user_id: string
  type: 'morning' | 'evening' | 'alert'
  content: string
  sent_at: string
  responded_at?: string
  response?: string
}
