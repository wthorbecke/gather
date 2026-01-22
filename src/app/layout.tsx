import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { PushNotifications } from '@/components/PushNotifications'
import './globals.css'

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
  themeColor: '#FAFAFA',
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
