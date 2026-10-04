'use client'

import Link from 'next/link'
import { Phone, MessageSquare } from 'lucide-react'
import { Initials, Panel } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { formatOverviewRelativeTime } from '@/lib/mctb/overview-display'
import type { MctbOverviewPayload } from '@/lib/mctb/overview-types'

export function MctbOverviewNeedsAttention({
  items,
}: {
  items: MctbOverviewPayload['needsAttention']
}) {
  if (!items.length) return null

  return (
    <Panel title="Needs attention" className="mt-4">
      <ul className="divide-y">
        {items.map((item) => {
          const detailHref = item.missedCallId
            ? `/mctb/missed-calls/${item.missedCallId}`
            : `/mctb/conversations?conversation=${item.conversationId}`
          return (
            <li key={item.conversationId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <Link href={detailHref} className="flex min-w-0 items-start gap-3 hover:opacity-90">
                <Initials name={item.name} className="size-9" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {item.name}
                    <span className="ml-2 text-xs font-medium text-primary">{item.reason}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.preview}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                    {item.phone} · {formatOverviewRelativeTime(item.updatedAt)}
                  </p>
                </div>
              </Link>
              <div className="flex shrink-0 gap-2 pl-12 sm:pl-0">
                <ButtonLink href={`tel:${item.phoneE164 || item.phone}`} variant="outline">
                  <Phone className="size-3.5" aria-hidden="true" />
                  Call
                </ButtonLink>
                <ButtonLink href={`/mctb/conversations?conversation=${item.conversationId}`}>
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  Open
                </ButtonLink>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
