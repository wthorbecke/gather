# Testing Guide

This project uses [Playwright](https://playwright.dev/) for end-to-end testing.

## Quick Start

```bash
# Run all tests
npm test

# Run tests with UI (interactive mode)
npm run test:ui

# Run tests with visible browser
npm run test:headed

# Debug tests
npm run test:debug

# View last test report
npm run test:report
```

## Test Structure

```
e2e/
├── helpers.ts        # Shared utilities and helper functions
├── auth.spec.ts      # Authentication and login tests
├── navigation.spec.ts # Tab navigation tests
├── tasks.spec.ts     # Tasks panel tests
├── today.spec.ts     # Today/Habits panel tests
└── soul.spec.ts      # Soul panel tests
```

## Writing Tests

### Required: Add Tests for New Features

**Every new feature or significant update must include tests.** This is enforced by:
1. CI checks on pull requests
2. The `./scripts/validate.sh` script

### Test File Naming

- Test files must end with `.spec.ts`
- Name files after the feature they test: `feature-name.spec.ts`

### Using Helpers

Import shared helpers to keep tests DRY:

```typescript
import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, addTask, screenshot } from './helpers'

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    await navigateToTab(page, 'Tasks')
  })

  test('does something', async ({ page }) => {
    // Your test here
  })
})
```

### Available Helpers

| Helper | Description |
|--------|-------------|
| `enterDemoMode(page)` | Navigate to app and enter demo mode |
| `navigateToTab(page, tab)` | Switch to a specific tab |
| `addTask(page, title, options?)` | Add a new task |
| `expectTaskVisible(page, title)` | Assert a task is visible |
| `screenshot(page, name)` | Take a debug screenshot |
| `setupApiErrorMonitoring(page)` | Monitor for PostgREST/Supabase errors |

### API Error Monitoring

Catch Supabase/PostgREST errors (like PGRST116) that would otherwise only show in the network tab:

```typescript
import { setupApiErrorMonitoring } from './helpers'

test('should have no API errors', async ({ page }) => {
  const apiMonitor = setupApiErrorMonitoring(page)
  
  await enterDemoMode(page)
  await navigateToTab(page, 'Tasks')
  
  // Do your test actions...
  
  // At the end, verify no API errors occurred
  apiMonitor.expectNoErrors()
})
```

The monitor captures:
- All responses from Supabase/PostgREST endpoints with status >= 400
- Error codes (e.g., `PGRST116`, `PGRST204`)
- Error messages and details

Methods available:
- `expectNoErrors()` - Fails test if any API errors occurred
- `getErrors()` - Returns array of captured errors for custom assertions
- `clearErrors()` - Resets the error collection (useful for multi-step tests)

### Writing Good Tests

1. **Test user behavior, not implementation**
   ```typescript
   // Good: Tests what user sees
   await expect(page.locator('text=Task added')).toBeVisible()

   // Bad: Tests internal state
   expect(component.state.tasks.length).toBe(1)
   ```

2. **Use descriptive test names**
   ```typescript
   // Good
   test('can add a task with urgent priority', ...)

   // Bad
   test('test1', ...)
   ```

3. **One assertion focus per test**
   ```typescript
   // Good: Focused test
   test('displays error when title is empty', ...)

   // Bad: Testing too many things
   test('form validation', ...)  // tests 5 different validations
   ```

4. **Use screenshots for debugging**
   ```typescript
   await screenshot(page, 'before-click')
   await button.click()
   await screenshot(page, 'after-click')
   ```

## Before Committing

Run the validation script to ensure everything passes:

```bash
./scripts/validate.sh
```

This checks:
- TypeScript compilation
- Linting
- Build success
- All E2E tests pass
- Tests were added for source changes

## CI Pipeline

Tests run automatically on:
- Every push to `main`
- Every pull request to `main`

The CI will:
1. Run all E2E tests
2. Upload test reports and screenshots as artifacts
3. Warn if source files changed without test updates

## Debugging Failed Tests

### View the HTML Report
```bash
npm run test:report
```

### Check Screenshots
Screenshots are saved to `e2e-screenshots/` during test runs.

### Run in Debug Mode
```bash
npm run test:debug
```
This opens Playwright Inspector where you can step through tests.

### Run a Single Test
```bash
npx playwright test -g "test name"
```

## Authenticated Testing (Real API)

For tests that hit real Supabase endpoints with actual user data:

### Setup Test User

1. Go to Supabase Dashboard → Authentication → Users → Add user
2. Create a user with email/password:
   - Email: `gather-test@yourproject.supabase.co` (any email works)
   - Password: Choose a secure password
3. Add credentials to `.env.local`:
   ```bash
   TEST_USER_EMAIL=gather-test@yourproject.supabase.co
   TEST_USER_PASSWORD=your-secure-password
   ```

### Running Authenticated Tests

```bash
# Run only authenticated tests
npx playwright test authenticated.spec.ts

# Run all tests (authenticated tests skip if credentials not set)
npm test
```

### Writing Authenticated Tests

```typescript
import { test, expect } from '@playwright/test'
import { loginAsTestUser, setupApiErrorMonitoring, canRunAuthenticatedTests } from './helpers'

test.describe('My Authenticated Feature', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!canRunAuthenticatedTests()) {
      testInfo.skip(true, 'Test credentials not configured')
    }
  })

  test('does something with real data', async ({ page }) => {
    const apiMonitor = setupApiErrorMonitoring(page)
    
    await loginAsTestUser(page)
    
    // Your test actions...
    
    apiMonitor.expectNoErrors()
  })
})
```

### Test Data Conventions

- Prefix test-created data with `Test:` for easy cleanup
- Example: `Test: My task name` or `Test: Subtask`
- This allows cleanup scripts to remove test data without affecting real data

## Adding a New Test File

1. Create `e2e/my-feature.spec.ts`
2. Import helpers and Playwright test utilities
3. Write tests using `test.describe` and `test`
4. Run `npm test` to verify

Example template:

```typescript
import { test, expect } from '@playwright/test'
import { enterDemoMode, navigateToTab, screenshot } from './helpers'

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
    // Setup for each test
  })

  test('should do something', async ({ page }) => {
    // Arrange
    await navigateToTab(page, 'Tasks')

    // Act
    await page.click('button')

    // Assert
    await expect(page.locator('text=Result')).toBeVisible()
  })
})
```
