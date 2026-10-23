'use client'

import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useNumbers } from '@/components/providers/numbers-provider'
import { formatPhone } from '@/lib/format'

const NUMBER_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  Active: { label: 'Active', tone: 'success' },
  Pending: { label: 'Pending', tone: 'warning' },
}

const FREE_TOOLS = [
  { name: 'Hiya Business Registration', href: 'https://hiya.com/business' },
  { name: 'First Orion (Free Caller Registry)', href: 'https://www.freecallerregistry.com/' },
  { name: 'Free Caller Registry', href: 'https://www.freecallerregistry.com/fcr/' },
]

export function PowerDialerNumberHealthContent() {
  const { owned } = useNumbers()

  return (
    <Page>
      <PageHeader
        title="Number health"
        description="Outbound numbers you can use as caller ID. Transovo metrics only — not carrier spam scores."
      />
      <Panel title="Outbound numbers" bodyClassName="p-0">
        <ul className="divide-y text-sm">
          {owned.length === 0 && (
            <li className="px-5 py-8 text-center text-muted-foreground">
              No active numbers.{' '}
              <Link href="/app/numbers" className="text-primary hover:underline">Manage numbers</Link>
            </li>
          )}
          {owned.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <span>
                <span className="font-medium">{n.nickname}</span>
                <span className="block font-mono text-xs text-muted-foreground">{formatPhone(n.number)}</span>
              </span>
              <StatusBadge tone={NUMBER_STATUS[n.status as keyof typeof NUMBER_STATUS]?.tone ?? 'neutral'}>
                {NUMBER_STATUS[n.status as keyof typeof NUMBER_STATUS]?.label ?? n.status}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Free reputation tools" description="External registration portals — not integrated APIs.">
        <ul className="flex flex-col gap-2 text-sm">
          {FREE_TOOLS.map((t) => (
            <li key={t.href}>
              <a href={t.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {t.name}
              </a>
            </li>
          ))}
        </ul>
      </Panel>
      <p className="text-xs text-muted-foreground">
        Per-number answer rates and premium Telnyx reputation monitoring are planned for Phase 5. We do not fabricate carrier spam scores from answer-rate data.
      </p>
    </Page>
  )
}
