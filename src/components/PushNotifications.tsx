'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'

// VAPID public key - generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if user dismissed the prompt before
    if (localStorage.getItem('notifications-dismissed')) {
      setDismissed(true)
      return
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission)

    // Only register service worker in production
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
      }).catch((err) => {
        console.error('Service worker registration failed:', err)
      })
    }
  }, [])

  const subscribe = async () => {
    if (!user || !VAPID_PUBLIC_KEY) return

    try {
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)

      if (permissionResult !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save subscription to Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

      if (error) {
        console.error('Failed to save subscription:', error)
      } else {
        setIsSubscribed(true)
      }
    } catch (err) {
      console.error('Failed to subscribe:', err)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('notifications-dismissed', 'true')
    setDismissed(true)
  }

  // Don't show anything if already subscribed, unsupported, or dismissed
  if (permission === 'unsupported' || isSubscribed || permission === 'denied' || dismissed) {
    return null
  }

  // Only show prompt after user is logged in
  if (!user) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-elevated border border-border rounded-2xl p-4 shadow-lg z-50 animate-fade-in">
      <p className="text-[0.9rem] text-text mb-3">
        Get gentle reminders to check in with Gather?
      </p>
      <div className="flex gap-2">
        <button
          onClick={subscribe}
          className="flex-1 py-2 bg-text text-white rounded-lg text-[0.85rem] hover:opacity-90 transition-opacity btn-press tap-target"
        >
          Enable notifications
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 text-text-muted text-[0.85rem] hover:text-text transition-colors btn-press tap-target"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
