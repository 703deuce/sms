'use client'

import { FileText, Globe, HelpCircle, MoreHorizontal, Plus, RefreshCw, Upload } from 'lucide-react'
import { Page, PageHeader, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'

export type VoiceKnowledgeWired = {
  businessName?: string
  description?: string
  services?: string
  website?: string
  timezone?: string
  gaps?: Array<{ id: string; question: string; asked: number; last: string }>
  hours?: Array<[string, string]>
  faqs?: Array<{ q: string; a: string }>
  sources?: Array<{ name: string; meta: string; status: string; icon?: 'globe' | 'file' }>
  crawlSummary?: string
  onSave?: () => Promise<void>
  onRecrawl?: () => Promise<void>
  onDismissGap?: (gapId: string) => Promise<void>
  onResolveGap?: (gapId: string, answerText: string) => Promise<void>
  onUploadClick?: () => void
  onAddFaq?: () => void
  onEditHours?: () => void
}

export const metadata: Metadata = { title: 'Business Knowledge' }

const GAPS = [
  { q: 'Do you offer financing for new water heaters?', asked: 4, last: 'Sep 24' },
  { q: 'Do you service Rinnai tankless units?', asked: 2, last: 'Sep 24' },
  { q: 'Is there a trip charge for Georgetown?', asked: 1, last: 'Sep 22' },
]

const FAQS = [
  { q: 'What areas do you serve?', a: 'Austin, Round Rock, Cedar Park, Pflugerville, and Leander.' },
  { q: 'Do you charge for estimates?', a: 'Estimates for replacements are free. Diagnostics are $89, waived if you proceed with the repair.' },
  { q: 'Are you licensed and insured?', a: 'Yes — Texas Master Plumber license M-40211, fully insured.' },
]

const SOURCES = [
  { icon: Globe, name: 'northsideplumbing.com', meta: '42 pages · Crawled 2 days ago', status: 'Synced' },
  { icon: FileText, name: 'Service price sheet 2026.pdf', meta: '3 pages · Uploaded Aug 14', status: 'Synced' },
  { icon: FileText, name: 'Membership plan terms.docx', meta: '2 pages · Uploaded Jul 2', status: 'Synced' },
]

const HOURS = [
  ['Mon – Fri', '7:00 AM – 6:00 PM'],
  ['Saturday', '8:00 AM – 2:00 PM'],
  ['Sunday', 'Closed · emergencies only'],
]

export function TransplantVoiceKnowledgePage({ wired }: { wired?: VoiceKnowledgeWired }) {
  const live = wired !== undefined
  const businessName = wired?.businessName ?? BUSINESS.name
  const gaps = live ? (wired?.gaps ?? []) : GAPS
  const hours = live ? (wired?.hours ?? []) : HOURS
  const faqs = live ? (wired?.faqs ?? []) : FAQS
  const sources = live
    ? (wired?.sources ?? [])
    : SOURCES.map((s) => ({ name: s.name, meta: s.meta, status: s.status, icon: s.icon === Globe ? 'globe' as const : 'file' as const }))
  const crawlSummary = wired?.crawlSummary ?? (live ? 'No crawl data yet' : '42 pages imported · Last crawl Sep 23, 3:12 PM')
  return (
    <Page>
      <PageHeader
        title="Business Knowledge"
        description="What your receptionist knows about your business. Keep it accurate so callers get the right answers."
        actions={<Button type="button" onClick={() => void wired?.onSave?.()}>Save changes</Button>}
      />

      <section aria-labelledby="gaps" className="mb-6 rounded-xl border border-warning/40 bg-warning/5">
        <div className="flex items-center justify-between border-b border-warning/30 px-5 py-3">
          <h2 id="gaps" className="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle className="size-4 text-warning" aria-hidden="true" /> Needs your review
          </h2>
          <span className="text-xs text-muted-foreground">Questions callers asked that Ava couldn&apos;t answer</span>
        </div>
        <ul className="divide-y divide-warning/20">
          {gaps.map((gap) => (
            <li key={gap.id ?? gap.q} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{gap.question ?? gap.q}</p>
                <p className="text-xs text-muted-foreground">
                  Asked {gap.asked}× · last {gap.last}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  disabled={!gap.id || !wired?.onDismissGap}
                  onClick={() => gap.id && void wired?.onDismissGap?.(gap.id)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={!gap.id || !wired?.onResolveGap}
                  onClick={() => {
                    if (!gap.id || !wired?.onResolveGap) return
                    const answer = window.prompt(`Approved answer for:\n${gap.question ?? gap.q}`)
                    if (answer?.trim()) void wired.onResolveGap(gap.id, answer.trim())
                  }}
                >
                  Add answer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Core business information">
          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="bname">Business name</Label>
              <Input id="bname" key={businessName} defaultValue={businessName} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bdesc">Description</Label>
              <Textarea
                id="bdesc"
                rows={3}
                key={wired?.description ?? 'desc-default'}
                defaultValue={wired?.description ?? 'Family-owned plumbing and HVAC company serving greater Austin since 2004. Residential repair, replacement, and maintenance.'}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bservices">Services</Label>
              <Input id="bservices" key={wired?.services ?? 'svc-default'} defaultValue={wired?.services ?? 'Water heaters, drains, repipes, AC & furnace repair, gas lines'} />
            </div>
          </div>
        </Panel>

        <Panel title="Business hours & timezone" description={wired?.timezone ?? BUSINESS.timezone}>
          <dl className="divide-y">
            {hours.map(([day, hours]) => (
              <div key={day} className="flex justify-between py-2.5 text-sm first:pt-0">
                <dt className="text-muted-foreground">{day}</dt>
                <dd className="tabular-nums">{hours}</dd>
              </div>
            ))}
          </dl>
          <Button variant="outline" size="sm" className="mt-4" type="button" onClick={() => wired?.onEditHours?.()}>
            Edit hours
          </Button>
        </Panel>

        <Panel title="Website" description="Import pages so Ava can answer from your site">
          <div className="flex gap-2">
            <Input aria-label="Website URL" defaultValue={wired?.website ? (wired.website.startsWith('http') ? wired.website : `https://${wired.website}`) : `https://${BUSINESS.website}`} />
            <Button variant="outline" type="button" onClick={() => void wired?.onRecrawl?.()}>
              <RefreshCw /> Re-crawl
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{crawlSummary}</p>
        </Panel>

        <Panel
          title="Knowledge sources"
          action={
            <Button size="sm" variant="outline" type="button" onClick={() => wired?.onUploadClick?.()}>
              <Upload /> Upload
            </Button>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {sources.map((s) => {
              const Icon = s.icon === 'globe' ? Globe : FileText
              return (
              <li key={s.name} className="flex items-center gap-3 px-5 py-3">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.meta}</p>
                </div>
                <Pill tone="success">{s.status}</Pill>
                <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${s.name}`}>
                  <MoreHorizontal />
                </Button>
              </li>
            )})}
          </ul>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="FAQs & approved answers"
        description="Ava will use these answers word-for-word"
        action={
          <Button size="sm" variant="outline" type="button" onClick={() => wired?.onAddFaq?.()}>
            <Plus /> Add FAQ
          </Button>
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y">
          {faqs.map((f) => (
            <li key={f.q} className="px-5 py-4">
              <p className="text-sm font-medium">{f.q}</p>
              <p className="mt-1 text-pretty text-sm text-muted-foreground">{f.a}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  )
}
