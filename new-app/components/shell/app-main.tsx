'use client'
import { usePathname } from 'next/navigation'
import { isAgentChatRoute, isClipEditRoute } from '@/lib/sidebar-nav'
export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const immersive = isClipEditRoute(pathname)
  const fillHeight = immersive || isAgentChatRoute(pathname)
  return (
    <main
      id="main"
      data-immersive={immersive ? '' : undefined}
      data-fill-height={fillHeight ? '' : undefined}
      className={
        immersive
          ? 'h-dvh min-h-0 overflow-hidden'
          : fillHeight
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'min-h-[calc(100dvh-3.5rem)]'
      }
    >
      {children}
    </main>
  )
}
