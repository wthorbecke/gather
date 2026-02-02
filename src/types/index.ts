import { TaskCategory, CheckinType } from '@/lib/constants'

export interface User {
  id: string
  phone: string
  timezone: string
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  category: TaskCategory
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
  type: CheckinType
  content: string
  sent_at: string
  responded_at?: string
  response?: string
}
