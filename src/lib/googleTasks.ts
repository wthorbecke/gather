/**
 * Google Tasks API Integration
 *
 * Provides utilities for syncing Google Tasks with Gather.
 * Handles CRUD operations for task lists and tasks.
 */

import { getValidToken, getGrantedScopes } from './google-auth'

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1'
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks'

// Google Tasks API Types
export interface GoogleTaskList {
  kind: 'tasks#taskList'
  id: string
  title: string
  updated: string
  selfLink: string
}

export interface GoogleTask {
  kind: 'tasks#task'
  id: string
  etag: string
  title: string
  updated: string
  selfLink: string
  parent?: string
  position: string
  notes?: string
  status: 'needsAction' | 'completed'
  due?: string
  completed?: string
  deleted?: boolean
  hidden?: boolean
  links?: Array<{ type: string; description: string; link: string }>
}

interface TaskListsResponse {
  kind: 'tasks#taskLists'
  items: GoogleTaskList[]
  nextPageToken?: string
}

interface TasksResponse {
  kind: 'tasks#tasks'
  items: GoogleTask[]
  nextPageToken?: string
}

// Error types for better error handling
export class GoogleTasksError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'GoogleTasksError'
  }
}

/**
 * Get authenticated headers for Google Tasks API
 */
async function getAuthHeaders(userId: string): Promise<Headers> {
  const accessToken = await getValidToken(userId)

  if (!accessToken) {
    throw new GoogleTasksError(
      'No valid Google access token available',
      'NO_TOKEN'
    )
  }

  return new Headers({
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  })
}

/**
 * Check if user has Tasks API scope
 */
export async function hasTasksScope(userId: string): Promise<boolean> {
  const scopes = await getGrantedScopes(userId)
  return scopes.includes(TASKS_SCOPE)
}

/**
 * Fetch all task lists for a user
 */
export async function fetchTaskLists(userId: string): Promise<GoogleTaskList[]> {
  const headers = await getAuthHeaders(userId)

  const response = await fetch(`${TASKS_API_BASE}/users/@me/lists`, {
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to fetch task lists: ${errorText}`,
      'FETCH_LISTS_FAILED',
      response.status
    )
  }

  const data: TaskListsResponse = await response.json()
  return data.items || []
}

/**
 * Get a specific task list by ID
 */
export async function getTaskList(
  userId: string,
  listId: string
): Promise<GoogleTaskList> {
  const headers = await getAuthHeaders(userId)

  const response = await fetch(`${TASKS_API_BASE}/users/@me/lists/${listId}`, {
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to get task list: ${errorText}`,
      'GET_LIST_FAILED',
      response.status
    )
  }

  return response.json()
}

/**
 * Fetch tasks from a specific list
 */
export async function fetchTasks(
  userId: string,
  listId: string,
  options?: {
    showCompleted?: boolean
    showHidden?: boolean
    showDeleted?: boolean
    updatedMin?: string
    maxResults?: number
    pageToken?: string
  }
): Promise<{ tasks: GoogleTask[]; nextPageToken?: string }> {
  const headers = await getAuthHeaders(userId)

  const params = new URLSearchParams()
  if (options?.showCompleted !== undefined) {
    params.set('showCompleted', String(options.showCompleted))
  }
  if (options?.showHidden !== undefined) {
    params.set('showHidden', String(options.showHidden))
  }
  if (options?.showDeleted !== undefined) {
    params.set('showDeleted', String(options.showDeleted))
  }
  if (options?.updatedMin) {
    params.set('updatedMin', options.updatedMin)
  }
  if (options?.maxResults) {
    params.set('maxResults', String(options.maxResults))
  }
  if (options?.pageToken) {
    params.set('pageToken', options.pageToken)
  }

  const url = `${TASKS_API_BASE}/lists/${listId}/tasks?${params}`
  const response = await fetch(url, { headers })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to fetch tasks: ${errorText}`,
      'FETCH_TASKS_FAILED',
      response.status
    )
  }

  const data: TasksResponse = await response.json()
  return {
    tasks: data.items || [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Fetch all tasks from a list (handles pagination)
 */
export async function fetchAllTasks(
  userId: string,
  listId: string,
  options?: {
    showCompleted?: boolean
    showHidden?: boolean
    updatedMin?: string
  }
): Promise<GoogleTask[]> {
  const allTasks: GoogleTask[] = []
  let pageToken: string | undefined

  do {
    const result = await fetchTasks(userId, listId, {
      ...options,
      maxResults: 100,
      pageToken,
    })
    allTasks.push(...result.tasks)
    pageToken = result.nextPageToken
  } while (pageToken)

  return allTasks
}

/**
 * Get a specific task by ID
 */
export async function getTask(
  userId: string,
  listId: string,
  taskId: string
): Promise<GoogleTask> {
  const headers = await getAuthHeaders(userId)

  const response = await fetch(
    `${TASKS_API_BASE}/lists/${listId}/tasks/${taskId}`,
    { headers }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to get task: ${errorText}`,
      'GET_TASK_FAILED',
      response.status
    )
  }

  return response.json()
}

/**
 * Create a task in Google Tasks
 */
export async function createGoogleTask(
  userId: string,
  listId: string,
  task: {
    title: string
    notes?: string
    due?: string // RFC 3339 date (e.g., "2024-01-15T00:00:00.000Z")
    parent?: string // Parent task ID for subtasks
  }
): Promise<GoogleTask> {
  const headers = await getAuthHeaders(userId)

  const params = new URLSearchParams()
  if (task.parent) {
    params.set('parent', task.parent)
  }

  const url = `${TASKS_API_BASE}/lists/${listId}/tasks${params.toString() ? `?${params}` : ''}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: task.title,
      notes: task.notes,
      due: task.due,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to create task: ${errorText}`,
      'CREATE_TASK_FAILED',
      response.status
    )
  }

  return response.json()
}

/**
 * Update a task in Google Tasks
 */
export async function updateGoogleTask(
  userId: string,
  listId: string,
  taskId: string,
  updates: Partial<{
    title: string
    notes: string
    due: string
    status: 'needsAction' | 'completed'
  }>
): Promise<GoogleTask> {
  const headers = await getAuthHeaders(userId)

  const response = await fetch(
    `${TASKS_API_BASE}/lists/${listId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to update task: ${errorText}`,
      'UPDATE_TASK_FAILED',
      response.status
    )
  }

  return response.json()
}

/**
 * Mark a Google Task as completed
 */
export async function completeGoogleTask(
  userId: string,
  listId: string,
  taskId: string
): Promise<GoogleTask> {
  return updateGoogleTask(userId, listId, taskId, { status: 'completed' })
}

/**
 * Mark a Google Task as incomplete
 */
export async function uncompleteGoogleTask(
  userId: string,
  listId: string,
  taskId: string
): Promise<GoogleTask> {
  return updateGoogleTask(userId, listId, taskId, { status: 'needsAction' })
}

/**
 * Delete a task from Google Tasks
 */
export async function deleteGoogleTask(
  userId: string,
  listId: string,
  taskId: string
): Promise<void> {
  const headers = await getAuthHeaders(userId)

  const response = await fetch(
    `${TASKS_API_BASE}/lists/${listId}/tasks/${taskId}`,
    {
      method: 'DELETE',
      headers,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to delete task: ${errorText}`,
      'DELETE_TASK_FAILED',
      response.status
    )
  }
}

/**
 * Move a task to a different position or parent
 */
export async function moveGoogleTask(
  userId: string,
  listId: string,
  taskId: string,
  options?: {
    parent?: string // Parent task ID (for making it a subtask)
    previous?: string // Previous sibling task ID (for ordering)
  }
): Promise<GoogleTask> {
  const headers = await getAuthHeaders(userId)

  const params = new URLSearchParams()
  if (options?.parent) {
    params.set('parent', options.parent)
  }
  if (options?.previous) {
    params.set('previous', options.previous)
  }

  const response = await fetch(
    `${TASKS_API_BASE}/lists/${listId}/tasks/${taskId}/move?${params}`,
    {
      method: 'POST',
      headers,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to move task: ${errorText}`,
      'MOVE_TASK_FAILED',
      response.status
    )
  }

  return response.json()
}

/**
 * Clear completed tasks from a list
 */
export async function clearCompletedTasks(
  userId: string,
  listId: string
): Promise<void> {
  const headers = await getAuthHeaders(userId)

  const response = await fetch(
    `${TASKS_API_BASE}/lists/${listId}/clear`,
    {
      method: 'POST',
      headers,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new GoogleTasksError(
      `Failed to clear completed tasks: ${errorText}`,
      'CLEAR_TASKS_FAILED',
      response.status
    )
  }
}

// Utility functions for working with Google Tasks

/**
 * Convert a Google Task due date to a JavaScript Date
 * Google Tasks uses RFC 3339 format
 */
export function parseDueDate(due: string | undefined): Date | null {
  if (!due) return null
  return new Date(due)
}

/**
 * Format a Date as an RFC 3339 date string for Google Tasks
 * Note: Google Tasks only uses the date part, not the time
 */
export function formatDueDate(date: Date): string {
  // Google Tasks expects the due date at midnight UTC
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T00:00:00.000Z`
}

/**
 * Check if a Google Task is completed
 */
export function isTaskCompleted(task: GoogleTask): boolean {
  return task.status === 'completed'
}

/**
 * Check if a Google Task is overdue
 */
export function isTaskOverdue(task: GoogleTask): boolean {
  if (!task.due || task.status === 'completed') return false
  const dueDate = new Date(task.due)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dueDate < today
}

/**
 * Get the default task list ID (usually "@default")
 * Falls back to first list if @default doesn't work
 */
export async function getDefaultTaskListId(userId: string): Promise<string> {
  const lists = await fetchTaskLists(userId)

  // Google Tasks has a default list that's always first
  if (lists.length > 0) {
    return lists[0].id
  }

  throw new GoogleTasksError(
    'No task lists found',
    'NO_LISTS'
  )
}
