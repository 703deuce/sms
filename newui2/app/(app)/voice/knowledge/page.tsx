import type { Metadata } from 'next'
import { FileText, Globe, HelpCircle, Plus, RefreshCw, Upload } from 'lucide-react'
import { Field, PageHeader, Panel, StatusPill } from '@/components/app/primitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { business } from '@/lib/data'

export const metadata: Metadata = { title: 'Business Knowledge' }

const gaps = [
  { q: 'Do you offer financing for tankless water heaters?', asked: 4, last: 'Yesterday' },
  { q: 'Are you licensed to work in Round Rock?', asked: 2, last: 'Sep 22' },
]

const faqs = [
  { q: 'Do you charge a trip fee?', a: 'Yes — $79 diagnostic, waived if you proceed with the repair.' },
  { q: 'Do you offer emergency service?', a: '24/7 for active leaks, no heat, and sewer backups. After-hours rates apply.' },
  { q: 'What areas do you serve?', a: 'Austin, Pflugerville, Cedar Park, Round Rock, and Buda.' },
]

const hours = [
  ['Monday – Friday', '7:00 AM – 7:00 PM'],
  ['Saturday', '8:00 AM – 4:00 PM'],
  ['Sunday', 'Emergency only'],
]

const sources = [
  { name: 'brightlineplumbing.com', type: 'Website', updated: 'Sep 20', status: 'Synced' },
  { name: 'Service price list 2026.pdf', type: 'Document', updated: 'Sep 12', status: 'Synced' },
  { name: 'Warranty terms.docx', type: 'Document', updated: 'Aug 30', status: 'Processing' },
]

export default function KnowledgePage() {
  return (
    <>
      <PageHeader
        title="Business Knowledge"
        description="Everything the receptionist knows about your business. Answers here are used on every call."
        actions={<Button className="h-9">Save changes</Button>}
      />

      <section id="knowledge-gaps" className="scroll-mt-20 rounded-xl border border-warning/40 bg-warning/5">
        <header className="flex items-center justify-between gap-4 border-b border-warning/30 px-5 py-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-warning" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Needs your review</h2>
            <StatusPill tone="warning">{gaps.length} open</StatusPill>
          </div>
        </header>
        <ul className="divide-y divide-warning/20">
          {gaps.map((g) => (
            <li key={g.q} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-sm font-medium">“{g.q}”</p>
                <p className="text-xs text-muted-foreground">
                  Asked {g.asked} times · last {g.last}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="bg-card">
                  Dismiss
                </Button>
                <Button size="sm">Add answer</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Core business information" bodyClassName="flex flex-col gap-4">
          <Field label="Business name" htmlFor="bname">
            <Input id="bname" defaultValue={business.name} />
          </Field>
          <Field label="Description" htmlFor="bdesc">
            <Textarea
              id="bdesc"
              rows={3}
              defaultValue="Family-owned residential plumbing and heating company serving Central Texas since 2009."
            />
          </Field>
          <Field label="Services" htmlFor="bservices" hint="Comma separated">
            <Input id="bservices" defaultValue="Water heaters, drain cleaning, repiping, leak repair, furnace service" />
          </Field>
        </Panel>

        <Panel title="Business hours & timezone" action={<StatusPill tone="neutral" dot={false}>{business.timezone}</StatusPill>} bodyClassName="p-0">
          <dl className="divide-y">
            {hours.map(([d, h]) => (
              <div key={d} className="flex items-center justify-between px-5 py-3.5">
                <dt className="text-sm text-muted-foreground">{d}</dt>
                <dd className="text-sm font-medium tabular-nums">{h}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t px-5 py-3">
            <Button variant="ghost" size="sm">
              Edit hours
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Website" description="We crawl your site weekly to keep answers current.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="website" className="sr-only">
              Website URL
            </label>
            <Input id="website" defaultValue={`https://${business.website}`} className="pl-9" />
          </div>
          <Button variant="outline">
            <RefreshCw aria-hidden="true" /> Re-crawl now
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Last crawled Sep 20, 2026 · 18 pages imported</p>
      </Panel>

      <Panel title="FAQs & approved answers" action={<Button variant="outline" size="sm"><Plus aria-hidden="true" /> Add FAQ</Button>} bodyClassName="p-0">
        <ul className="divide-y">
          {faqs.map((f) => (
            <li key={f.q} className="flex flex-col gap-1 px-5 py-4">
              <p className="text-sm font-medium">{f.q}</p>
              <p className="text-sm text-muted-foreground">{f.a}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Knowledge sources" action={<Button variant="outline" size="sm"><Upload aria-hidden="true" /> Upload</Button>} bodyClassName="p-0">
        <ul className="divide-y">
          {sources.map((s) => (
            <li key={s.name} className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                {s.type === 'Website' ? <Globe className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.type} · updated {s.updated}
                </span>
              </div>
              <StatusPill tone={s.status === 'Synced' ? 'success' : 'info'}>{s.status}</StatusPill>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
