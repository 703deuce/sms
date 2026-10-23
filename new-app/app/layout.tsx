import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Transovo',
    template: '%s · Transovo',
  },
  description:
    'Transovo business communications: Phone with standard and power dialer, AI Receptionist, and Missed Call Text Back on one shared workspace.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#f8f9fb',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
        {process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}
