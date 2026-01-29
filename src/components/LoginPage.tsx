'use client'

import { useAuth } from './AuthProvider'

interface LoginPageProps {
  onTryDemo?: () => void
}

export function LoginPage({ onTryDemo }: LoginPageProps) {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center px-6 login-gradient">
      <div className="max-w-sm w-full login-container">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-semibold text-text tracking-tight mb-1 login-title">
            Gather
          </h1>
          <p className="text-2xl font-medium text-text leading-tight mb-6 login-subtitle">
            Dump it here — I&apos;ll make it doable
            <span className="cursor-blink" />
          </p>
          <p className="text-base text-text-soft leading-relaxed login-body">
            AI breaks down overwhelming tasks into small steps.
            <br />
            No judgment, just progress.
          </p>
        </div>

        <div className="space-y-4 login-actions">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-md font-medium google-btn btn-press tap-target"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-text">Continue with Google</span>
          </button>

          {onTryDemo && (
            <button
              onClick={onTryDemo}
              aria-label="Try the demo"
              className="
                w-full px-5 py-3
                text-text-soft hover:text-text
                font-medium text-base
                transition-colors duration-150
                btn-press tap-target
                group
              "
            >
              Try the demo first{' '}
              <span className="inline-block transition-transform duration-150 ease-out group-hover:translate-x-0.5">
                →
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
