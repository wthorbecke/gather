'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from './Modal'
import { useAuth } from './AuthProvider'

interface IntegrationSettingsProps {
  isOpen: boolean
  onClose: () => void
}

interface IntegrationStatus {
  googleConnected: boolean
  gmail: {
    enabled: boolean
    active: boolean
    expiration?: string
  }
  calendar: {
    enabled: boolean
    active: boolean
    expiration?: string
  }
}

export function IntegrationSettings({ isOpen, onClose }: IntegrationSettingsProps) {
  const { session } = useAuth()
  const [status, setStatus] = useState<IntegrationStatus>({
    googleConnected: false,
    gmail: { enabled: false, active: false },
    calendar: { enabled: false, active: false },
  })
  const [loading, setLoading] = useState<'gmail' | 'calendar' | 'connect' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if Google is connected with proper scopes
  const checkGoogleConnection = useCallback(async () => {
    if (!session?.access_token) return false

    try {
      const res = await fetch('/api/auth/google/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      // Debug log removed('[IntegrationSettings] Google status:', data)

      return data.connected === true
    } catch {
      return false
    }
  }, [session?.access_token])

  // Fetch integration status
  const fetchStatus = useCallback(async () => {
    if (!session?.access_token) return

    try {
      const googleConnected = await checkGoogleConnection()

      if (!googleConnected) {
        setStatus({
          googleConnected: false,
          gmail: { enabled: false, active: false },
          calendar: { enabled: false, active: false },
        })
        return
      }

      const [gmailRes, calendarRes] = await Promise.all([
        fetch('/api/gmail/watch', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/calendar/watch', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ])

      const gmailData = gmailRes.ok ? await gmailRes.json() : { active: false }
      const calendarData = calendarRes.ok ? await calendarRes.json() : { active: false }

      setStatus({
        googleConnected: true,
        gmail: {
          enabled: gmailData.active,
          active: gmailData.active,
          expiration: gmailData.expiration,
        },
        calendar: {
          enabled: calendarData.active,
          active: calendarData.active,
          expiration: calendarData.expiration,
        },
      })
    } catch (err) {
      // Error handled silently('Error fetching integration status:', err)
    }
  }, [session?.access_token, checkGoogleConnection])

  useEffect(() => {
    if (isOpen) {
      fetchStatus()
    }
  }, [isOpen, fetchStatus])

  // Check URL params for connection result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('integration_connected') === 'true') {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
      // Refresh status
      fetchStatus()
    }
    if (params.get('integration_error')) {
      setError('Failed to connect Google. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [fetchStatus])

  const handleConnectGoogle = async () => {
    if (!session?.access_token) return

    setLoading('connect')
    setError(null)

    try {
      const res = await fetch('/api/auth/google/connect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        throw new Error('Failed to start Google connection')
      }

      const data = await res.json()

      // Redirect to Google OAuth
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  const handleToggleGmail = async () => {
    if (!session?.access_token) return

    setLoading('gmail')
    setError(null)

    try {
      if (status.gmail.enabled) {
        const res = await fetch('/api/gmail/watch', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error('Failed to disable Gmail notifications')
        setStatus(prev => ({
          ...prev,
          gmail: { enabled: false, active: false },
        }))
      } else {
        const res = await fetch('/api/gmail/watch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to enable Gmail notifications')
        }
        const data = await res.json()
        setStatus(prev => ({
          ...prev,
          gmail: { enabled: true, active: true, expiration: data.expiration },
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  const handleToggleCalendar = async () => {
    if (!session?.access_token) return

    setLoading('calendar')
    setError(null)

    try {
      if (status.calendar.enabled) {
        const res = await fetch('/api/calendar/watch', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error('Failed to disable Calendar sync')
        setStatus(prev => ({
          ...prev,
          calendar: { enabled: false, active: false },
        }))
      } else {
        // Try to enable calendar - use simple sync endpoint instead of watch
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to enable Calendar sync')
        }
        setStatus(prev => ({
          ...prev,
          calendar: { enabled: true, active: true },
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  const handleDisconnectGoogle = async () => {
    if (!session?.access_token) return

    setLoading('connect')
    setError(null)

    try {
      const res = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        throw new Error('Failed to disconnect Google')
      }

      setStatus({
        googleConnected: false,
        gmail: { enabled: false, active: false },
        calendar: { enabled: false, active: false },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Integrations" maxWidth="420px">
      <div className="px-5 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-danger-soft rounded-lg text-sm text-danger flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-danger hover:text-danger/80 transition-colors duration-150 ease-out flex-shrink-0 p-1"
              aria-label="Dismiss error"
            >
              <svg width={14} height={14} viewBox="0 0 16 16">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {!status.googleConnected ? (
          // Google not connected - show connect button
          <div className="p-4 bg-surface rounded-xl border border-border">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                <svg width={20} height={20} viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-text">Connect Google</h3>
                <p className="text-sm text-text-muted mt-1">
                  Connect your Google account to enable Gmail and Calendar integrations
                </p>
                <button
                  onClick={handleConnectGoogle}
                  disabled={loading === 'connect'}
                  className="mt-3 px-4 py-2 bg-text text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading === 'connect' ? 'Connecting...' : 'Connect Google'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Gmail Integration */}
            <div className="p-4 bg-surface rounded-xl border border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                  <svg width={20} height={20} viewBox="0 0 24 24" className="text-accent">
                    <path
                      d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <polyline
                      points="22,6 12,13 2,6"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-text">Gmail</h3>
                    <button
                      onClick={handleToggleGmail}
                      disabled={loading === 'gmail'}
                      className={`
                        relative w-11 h-7 min-h-[44px] rounded-full transition-colors duration-150 ease-out
                        ${status.gmail.enabled ? 'bg-accent' : 'bg-border'}
                        ${loading === 'gmail' ? 'opacity-50' : ''}
                        flex items-center
                      `}
                      aria-label={status.gmail.enabled ? 'Disable Gmail notifications' : 'Enable Gmail notifications'}
                      role="switch"
                      aria-checked={status.gmail.enabled}
                    >
                      <span
                        className={`
                          absolute top-1 left-1 w-5 h-5 rounded-full bg-white
                          transition-transform duration-200 ease-out shadow-sm
                          ${status.gmail.enabled ? 'translate-x-4' : ''}
                        `}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-text-muted mt-1">
                    Get notified about actionable emails like bills, appointments, and deadlines
                  </p>
                  {status.gmail.enabled && status.gmail.expiration && (
                    <p className="text-xs text-text-muted mt-2">
                      Active until {new Date(status.gmail.expiration).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Calendar Integration */}
            <div className="p-4 bg-surface rounded-xl border border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                  <svg width={20} height={20} viewBox="0 0 24 24" className="text-accent">
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="18"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-text">Google Calendar</h3>
                    <button
                      onClick={handleToggleCalendar}
                      disabled={loading === 'calendar'}
                      className={`
                        relative w-11 h-7 min-h-[44px] rounded-full transition-colors duration-150 ease-out
                        ${status.calendar.enabled ? 'bg-accent' : 'bg-border'}
                        ${loading === 'calendar' ? 'opacity-50' : ''}
                        flex items-center
                      `}
                      aria-label={status.calendar.enabled ? 'Disable Calendar sync' : 'Enable Calendar sync'}
                      role="switch"
                      aria-checked={status.calendar.enabled}
                    >
                      <span
                        className={`
                          absolute top-1 left-1 w-5 h-5 rounded-full bg-white
                          transition-transform duration-200 ease-out shadow-sm
                          ${status.calendar.enabled ? 'translate-x-4' : ''}
                        `}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-text-muted mt-1">
                    See upcoming events and add task deadlines to your calendar
                  </p>
                  {status.calendar.enabled && status.calendar.expiration && (
                    <p className="text-xs text-text-muted mt-2">
                      Active until {new Date(status.calendar.expiration).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Disconnect option */}
        {status.googleConnected && (
          <button
            onClick={handleDisconnectGoogle}
            disabled={loading === 'connect'}
            className="w-full text-center text-sm text-text-muted hover:text-danger transition-colors duration-150 ease-out py-2 min-h-[44px]"
          >
            {loading === 'connect' ? 'Disconnecting...' : 'Disconnect Google Account'}
          </button>
        )}

        {/* Info note */}
        <p className="text-xs text-text-muted text-center px-4">
          Integrations sync automatically. Your data stays private.
        </p>
      </div>
    </Modal>
  )
}
