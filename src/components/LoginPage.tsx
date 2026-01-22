'use client'

import { useAuth } from './AuthProvider'

interface LoginPageProps {
  onTryDemo?: () => void
}

export function LoginPage({ onTryDemo }: LoginPageProps) {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-canvas">
      <div className="max-w-md w-full">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold text-text tracking-tight mb-3">
            Gather
          </h1>
          <p className="text-text-soft text-lg leading-relaxed">
            Dump it here — I'll make it doable
          </p>
        </div>

        {/* Quote */}
        <div className="text-center p-6 mb-8 bg-accent-soft rounded-2xl">
          <p className="text-lg text-text leading-relaxed">
            "The part of your brain that ADHD impacts, externalized into software."
          </p>
        </div>

        {/* Sign in button */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-elevated border border-border rounded-xl text-text hover:shadow-hover hover:border-accent transition-all btn-press"
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
          <span className="text-base font-medium">Continue with Google</span>
        </button>

        {onTryDemo && (
          <button
            onClick={onTryDemo}
            className="w-full mt-3 px-6 py-3 text-text-muted hover:text-text text-sm transition-colors"
          >
            Try demo (no sign in)
          </button>
        )}

        {/* Features */}
        <div className="mt-10 space-y-3 text-sm text-text-soft">
          <div className="flex items-start gap-3">
            <span className="text-success">✓</span>
            <span>AI breaks down overwhelming tasks into doable steps</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-success">✓</span>
            <span>Ongoing collaboration when you get stuck</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-success">✓</span>
            <span>No judgment, no guilt — just progress</span>
          </div>
        </div>
      </div>
    </div>
  )
}
