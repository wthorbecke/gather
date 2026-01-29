'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { LoginPage } from '@/components/LoginPage'
import { GatherApp } from '@/components/GatherApp'
import { User } from '@supabase/supabase-js'
import { content } from '@/config/content'
import { safeRemoveItem } from '@/lib/storage'

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [demoMode, setDemoMode] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  // Show login page immediately, don't wait for auth check
  // This prevents loading spinner from blocking the UI
  useEffect(() => {
    // If auth takes too long, show login anyway
    const timer = setTimeout(() => {
      if (authLoading) {
        setShowLogin(true)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [authLoading])

  // Show login page when not loading or when explicitly shown
  const shouldShowLogin = (!authLoading && !user && !demoMode) || (showLogin && !user && !demoMode)

  // Still loading but don't block UI
  if (authLoading && !showLogin && !user && !demoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <h1 className="text-2xl font-display font-semibold text-text mb-4">Gather</h1>
          <div className="flex justify-center gap-1">
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
            <span className="w-2 h-2 bg-accent-soft rounded-full loading-dot" />
          </div>
        </div>
      </div>
    )
  }

  // Not logged in - show login page
  if (shouldShowLogin) {
    return (
      <LoginPage
        onTryDemo={() => {
          // Clear only legacy v1 storage format, preserve current demo data
          safeRemoveItem('gather-demo-tasks-v1')
          setDemoMode(true)
        }}
      />
    )
  }

  // Demo mode - show app with local-only data
  if (demoMode && !user) {
    const demoUser: User = {
      id: 'demo-user',
      email: 'demo@gather.local',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User
    return <GatherApp user={demoUser} onSignOut={async () => setDemoMode(false)} />
  }

  // Logged in - show main app
  if (user) {
    return <GatherApp user={user} onSignOut={signOut} />
  }

  return null
}
