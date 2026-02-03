import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Global setup for Playwright E2E tests
 *
 * This ensures a clean build state to prevent hydration issues
 * caused by stale Next.js build cache.
 */
export default async function globalSetup() {
  const projectRoot = path.resolve(__dirname, '..')
  const nextDir = path.join(projectRoot, '.next')

  // In CI, always do a clean build
  if (process.env.CI) {
    console.log('[E2E Setup] Running in CI - ensuring clean build...')

    // Remove .next directory if it exists
    if (fs.existsSync(nextDir)) {
      console.log('[E2E Setup] Removing stale .next directory...')
      fs.rmSync(nextDir, { recursive: true, force: true })
    }

    // Run build
    console.log('[E2E Setup] Building Next.js app...')
    execSync('npm run build', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    })

    console.log('[E2E Setup] Build complete.')
  } else {
    // In local dev, just check that .next exists
    // and has recent build files
    if (!fs.existsSync(nextDir)) {
      console.log('[E2E Setup] No .next directory found - building...')
      execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'inherit'
      })
    } else {
      // Check if build is recent (within last hour)
      const buildIdPath = path.join(nextDir, 'BUILD_ID')
      if (fs.existsSync(buildIdPath)) {
        const stats = fs.statSync(buildIdPath)
        const ageMs = Date.now() - stats.mtimeMs
        const ageHours = ageMs / (1000 * 60 * 60)

        if (ageHours > 24) {
          console.log(`[E2E Setup] Build is ${Math.round(ageHours)} hours old - consider running 'npm run build' for fresh build`)
        }
      }
    }
  }
}
