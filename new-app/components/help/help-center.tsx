'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clapperboard, ExternalLink, Film, LifeBuoy, Music, Palette, Scissors, Type, Upload } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { SearchInput } from '@/components/app/filters'

const START = [
  {
    title: 'Upload a video',
    icon: Upload,
    href: '/app/clips',
    body: 'Start a project, upload your source file, and wait for transcription and clip suggestions.',
  },
  {
    title: 'Review clips',
    icon: Film,
    href: '/app/clips',
    body: 'Open a project, preview suggested clips, and pick the ones you want to edit or export.',
  },
  {
    title: 'Open the editor',
    icon: Scissors,
    href: '/app/clips',
    body: 'Trim on the transcript, adjust layout and aspect ratio, and preview changes before export.',
  },
]

const TOPICS = [
  {
    title: 'Captions',
    icon: Type,
    body: 'Choose a preset, position, animation, and words per line. Captions in the preview match export styling.',
  },
  {
    title: 'Layout & aspect',
    icon: Clapperboard,
    body: 'Switch between speaker follow, fill, and center crop. Set 9:16, 1:1, 4:5, or 16:9 for preview and export.',
  },
  {
    title: 'B-roll & music',
    icon: Music,
    body: 'Drop stock or AI B-roll on the timeline, duck music under speech, and add SFX from the Audio panel.',
  },
  {
    title: 'Export & brand',
    icon: Palette,
    body: 'Export MP4 from the editor toolbar. Apply saved brand logos and templates from the Brand panel.',
  },
]

const FAQ = [
  {
    q: 'Why is my preview empty or still loading?',
    a: 'Wait for the proxy video to finish processing. If preview fails, reload the page; other panels still work while we fix the clip. Check your network if the video URL cannot load.',
  },
  {
    q: 'Do caption changes apply to already-exported files?',
    a: 'No. Edits apply to the next export only. Re-export after changing captions, layout, or trim.',
  },
  {
    q: 'Why did my stock B-roll not show in preview?',
    a: 'Stock clips need a resolved media file. If the asset is missing or still caching, the slot stays empty until media is available.',
  },
  {
    q: 'What does silence trim do?',
    a: 'It shortens long pauses in the transcript timeline. Export may compute cut ranges even when the preview still plays the full trim until cuts are applied at render time.',
  },
  {
    q: 'How do I get 1080p?',
    a: 'Use Export in the editor and pick your resolution. Longer sources may take more time to render.',
  },
]

export function HelpCenter() {
  const [query, setQuery] = useState('')
  const faqs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? FAQ.filter((f) => (f.q + f.a).toLowerCase().includes(q)) : FAQ
  }, [query])

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Get started" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {START.map((s) => (
          <Link key={s.title} href={s.href} className="group flex flex-col gap-3 rounded-xl surface p-5 hover:border-primary/50">
            <s.icon className="size-5 text-primary" />
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
            <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
              Go to Clips
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      <section aria-label="Editor topics" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <div key={t.title} className="flex gap-3 rounded-xl surface p-5">
            <t.icon className="size-5 shrink-0 text-primary" />
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">{t.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.body}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          title="Clipper FAQs"
          className="lg:col-span-2"
          actions={<SearchInput value={query} onChange={setQuery} placeholder="Search FAQs…" />}
        >
          {faqs.length ? (
            <div className="flex flex-col divide-y">
              {faqs.map((f) => (
                <details key={f.q} className="group py-3 first:pt-0">
                  <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">{f.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No FAQs match &ldquo;{query}&rdquo;.</p>
          )}
        </Panel>

        <Panel title="Still stuck?">
          <div className="flex flex-col gap-2">
            <a href="mailto:support@transovo.com" className={buttonVariants({ className: 'w-full' })}>
              <LifeBuoy />
              Contact support
            </a>
            <a
              href="https://status.transovo.com"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', className: 'w-full' })}
            >
              System status
              <ExternalLink />
            </a>
          </div>
        </Panel>
      </div>
    </div>
  )
}
