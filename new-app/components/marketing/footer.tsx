import Link from 'next/link'
import { hrefs } from './links'
import { MarketingLogo } from './logo'

const cols = [
  {
    title: 'Product',
    links: [
      { href: hrefs.home, label: 'Home' },
      { href: hrefs.aiClips, label: 'AI Clips' },
      { href: hrefs.videoEditing, label: 'Video Editing' },
      { href: hrefs.streamer, label: 'Streamer' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { href: hrefs.clipsNew, label: 'Start clipping' },
      { href: hrefs.editorNew, label: 'Open the studio' },
      { href: hrefs.clips, label: 'Open Clips' },
      { href: hrefs.app, label: 'Log in' },
      { href: hrefs.help, label: 'Help' },
    ],
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-panel">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <MarketingLogo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Turn long videos into short clips, edit by transcript, and export ready-to-post videos.
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 rounded-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 Transovo Clips</p>
          <p className="font-mono uppercase tracking-[0.12em]">Usage is measured in credits</p>
        </div>
      </div>
    </footer>
  )
}
