'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Processing sign in...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session - this reads from URL hash
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          // Error handled silently('[AuthCallback] Error getting session:', error)
          setStatus('Error signing in')
          setTimeout(() => router.push('/'), 2000)
          return
        }

        if (!session) {
          // Debug log removed('[AuthCallback] No session found')
          setStatus('No session found')
          setTimeout(() => router.push('/'), 1000)
          return
        }

        // Debug log removed: session found

        // If we have provider tokens, store them
        if (session.provider_token) {
          setStatus('Storing Google credentials...')

          const res = await fetch('/api/auth/store-tokens', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              provider_token: session.provider_token,
              provider_refresh_token: session.provider_refresh_token || '',
            }),
          })

          if (res.ok) {
            // Debug log removed('[AuthCallback] Tokens stored successfully')
          } else {
            const data = await res.json()
            // Error handled silently('[AuthCallback] Failed to store tokens:', data)
          }
        }

        // Redirect home
        router.push('/')
      } catch (err) {
        // Error handled silently('[AuthCallback] Unexpected error:', err)
        setStatus('Something went wrong')
        setTimeout(() => router.push('/'), 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-soft">{status}</p>
      </div>
    </div>
  )
}
