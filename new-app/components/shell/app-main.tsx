'use client'
import { usePathname } from 'next/navigation'
import { isClipEditRoute } from '@/lib/sidebar-nav'
export function AppMain({ children }: { children: React.ReactNode }) {
  const immersive = isClipEditRoute(usePathname() ?? '')
  return (
    <main id="main" data-immersive={immersive ? '' : undefined}
      className={immersive ? 'h-dvh min-h-0 overflow-hidden' : 'min-h-[calc(100dvh-3.5rem)]'}>
      {children}
    </main>
  )
}
