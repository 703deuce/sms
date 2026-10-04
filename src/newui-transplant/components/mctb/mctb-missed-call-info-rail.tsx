'use client'

import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

export type MctbMissedCallInfoRailSection = {
  title: string
  rows: Array<{ label: string; value: string }>
}

export function MctbMissedCallInfoRail({
  sections,
  className,
}: {
  sections: MctbMissedCallInfoRailSection[]
  className?: string
}) {
  return (
    <aside className={cn(OPUS_CARD, 'divide-y p-0', className)} aria-label="Caller and recovery details">
      {sections.map((section) => (
        <div key={section.title} className="px-4 py-4 md:px-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
          <dl className="mt-3 space-y-2.5">
            {section.rows.map((row) => (
              <div key={`${section.title}-${row.label}`} className="flex flex-col gap-0.5">
                <dt className="text-[11px] font-medium text-muted-foreground">{row.label}</dt>
                <dd className="text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </aside>
  )
}
