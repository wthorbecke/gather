import { test, expect } from '@playwright/test'

/**
 * API Integration Tests
 * These tests verify the backend/database schema matches frontend expectations
 * Run with a test database to catch schema mismatches early
 */

test.describe('API Schema Validation', () => {
  // Skip these unless TEST_SUPABASE_URL is set
  test.beforeEach(({}, testInfo) => {
    if (!process.env.TEST_SUPABASE_URL) {
      testInfo.skip(true, 'Requires TEST_SUPABASE_URL environment variable')
    }
  })

  test('tasks table has required columns', async ({ request }) => {
    const supabaseUrl = process.env.TEST_SUPABASE_URL
    const supabaseKey = process.env.TEST_SUPABASE_ANON_KEY

    // Try to select all expected columns
    const response = await request.get(
      `${supabaseUrl}/rest/v1/tasks?select=id,user_id,title,description,category,badge,due_date,subtasks,notes,actions,created_at&limit=0`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )

    // If column doesn't exist, Supabase returns 400 with PGRST204
    expect(response.status()).toBe(200)
  })

  test('habits table has required columns', async ({ request }) => {
    const supabaseUrl = process.env.TEST_SUPABASE_URL
    const supabaseKey = process.env.TEST_SUPABASE_ANON_KEY

    const response = await request.get(
      `${supabaseUrl}/rest/v1/habits?select=id,user_id,name,description,category,link,sort_order,active&limit=0`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )

    expect(response.status()).toBe(200)
  })

  test('soul_activities table has required columns', async ({ request }) => {
    const supabaseUrl = process.env.TEST_SUPABASE_URL
    const supabaseKey = process.env.TEST_SUPABASE_ANON_KEY

    const response = await request.get(
      `${supabaseUrl}/rest/v1/soul_activities?select=id,user_id,name,icon,icon_color,default_text,sort_order,active&limit=0`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )

    expect(response.status()).toBe(200)
  })
})
