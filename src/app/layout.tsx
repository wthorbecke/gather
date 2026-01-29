import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

// Lazy load PushNotifications - not critical for first paint
const PushNotifications = dynamic(
  () => import('@/components/PushNotifications').then(mod => ({ default: mod.PushNotifications })),
  { ssr: false }
)

export const metadata: Metadata = {
  title: 'Gather',
  description: 'Dump it here — I\'ll make it doable',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gather',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-canvas text-text">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <PushNotifications />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
