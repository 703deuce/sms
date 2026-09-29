import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarCheck, Check, MessageSquareText, PhoneForwarded, Play, UserPlus, Voicemail } from 'lucide-react'
import { PageHeader, Panel, StatusPill } from '@/components/app/primitives'
import { buttonVariants } from '@/components/ui/button'
import { business } from '@/lib/data'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Receptionist' }

const capabilities = [
  { icon: CalendarCheck, label: 'Book appointments', detail: 'Google Calendar · 30-min slots' },
  { icon: UserPlus, label: 'Capture leads', detail: 'Name, need, address, urgency' },
  { icon: PhoneForwarded, label: 'Transfer calls', detail: '3 targets · emergency routing' },
  { icon: MessageSquareText, label: 'Take messages', detail: 'Emailed and texted to team' },
  { icon: Voicemail, label: 'Voicemail fallback', detail: 'After 3 failed transfers' },
]

export default function ReceptionistPage() {
  return (
    <>
      <PageHeader
        title="Receptionist"
        description="A summary of your published AI receptionist. Open the editor to change voice, greeting, or behavior."
        actions={
          <>
            <Link href="/mctb/setup" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
              Continue setup
            </Link>
            <Link href="/voice/knowledge" className={cn(buttonVariants(), 'h-9')}>
              Open setup editor
            </Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Status" className="lg:col-span-2" bodyClassName="p-0">
          <dl className="divide-y">
            <div className="grid gap-1 px-5 py-4 sm:grid-cols-3">
              <dt className="text-sm text-muted-foreground">Publish status</dt>
              <dd className="sm:col-span-2">
                <StatusPill tone="success">Published</StatusPill>
              </dd>
            </div>
            <div className="grid gap-1 px-5 py-4 sm:grid-cols-3">
              <dt className="text-sm text-muted-foreground">Receptionist name</dt>
              <dd className="text-sm font-medium sm:col-span-2">{business.receptionist}</dd>
            </div>
            <div className="grid gap-1 px-5 py-4 sm:grid-cols-3">
              <dt className="text-sm text-muted-foreground">Voice</dt>
              <dd className="text-sm font-medium sm:col-span-2">{business.voice}</dd>
            </div>
            <div className="grid gap-1 px-5 py-4 sm:grid-cols-3">
              <dt className="text-sm text-muted-foreground">Greeting</dt>
              <dd className="sm:col-span-2">
                <blockquote className="rounded-lg border-l-2 border-primary bg-accent/50 px-4 py-3 text-sm leading-relaxed">
                  “Thanks for calling Brightline Plumbing &amp; Heating, this is Amy. How can I help today?”
                </blockquote>
              </dd>
            </div>
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
              <dt className="text-sm text-muted-foreground">Capabilities</dt>
              <dd className="sm:col-span-2">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {capabilities.map((c) => (
                    <li key={c.label} className="flex items-start gap-3 rounded-lg border p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <c.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{c.label}</span>
                        <span className="text-xs text-muted-foreground">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </Panel>

        <div className="flex flex-col gap-6">
          <section className="relative overflow-hidden rounded-xl border bg-sidebar p-5 text-sidebar-foreground">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-16 size-48 rounded-full bg-[oklch(0.55_0.22_277/0.4)] blur-3xl" />
            <div className="relative flex flex-col gap-4">
              <h2 className="text-sm font-semibold">Hear Amy</h2>
              <p className="text-sm text-sidebar-muted">Preview the greeting exactly as callers hear it.</p>
              <div className="flex items-end gap-0.5" aria-hidden="true">
                {Array.from({ length: 36 }, (_, i) => (
                  <span key={i} className="w-1 rounded-full bg-sidebar-primary/70" style={{ height: `${8 + Math.abs(Math.sin(i * 0.7)) * 28}px` }} />
                ))}
              </div>
              <button type="button" className="inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-sidebar">
                <Play className="size-4" aria-hidden="true" /> Play greeting
              </button>
            </div>
          </section>
          <Panel title="Setup progress">
            <ul className="flex flex-col gap-3">
              {['Voice & persona', 'Greeting', 'Business knowledge', 'Call handling', 'Go live'].map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className={cn('flex size-5 items-center justify-center rounded-full', i < 4 ? 'bg-success text-white' : 'border-2 border-dashed')}>
                    {i < 4 && <Check className="size-3" aria-hidden="true" />}
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
