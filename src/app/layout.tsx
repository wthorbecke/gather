import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/AuthProvider'
import { PushNotifications } from '@/components/PushNotifications'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gather',
  description: 'Your calm companion for getting things done',
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
  themeColor: '#FAF9F7',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <PushNotifications />
        </AuthProvider>
      </body>
    </html>
  )
}
