import Link from 'next/link'
import { Menu } from 'lucide-react'
import { hrefs } from './links'
import { MarketingLogo } from './logo'
import { PrimaryCta } from './cta'
import { cn } from '../../lib/utils'

const links = [
  { href: hrefs.aiClips, label: 'AI Clips' },
  { href: hrefs.videoEditing, label: 'Video Editing' },
  { href: hrefs.help, label: 'Help' },
] as const

export function MarketingNav({ current }: { current?: 'home' | 'ai-clips' | 'video-editing' }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <MarketingLogo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              (current === 'ai-clips' && link.href === hrefs.aiClips) ||
              (current === 'video-editing' && link.href === hrefs.videoEditing)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                  active && 'bg-muted text-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={hrefs.app}
            className="hidden h-9 items-center rounded-lg px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
          >
            Log in
          </Link>
          <PrimaryCta href={hrefs.clips} className="hidden h-9 px-4 shadow-xs sm:inline-flex">
            Open Clips
          </PrimaryCta>
          <details className="relative md:hidden">
            <summary
              className="flex size-9 list-none items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none marker:content-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-4" aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-lg">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={hrefs.app}
                className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Log in
              </Link>
              <Link
                href={hrefs.clips}
                className="mt-1 block rounded-lg bg-brand-gradient px-3 py-2 text-center text-sm font-medium text-brand-foreground"
              >
                Open Clips
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
