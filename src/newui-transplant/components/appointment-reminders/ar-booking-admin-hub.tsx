'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { buildBookingAdminCatalog } from '@/lib/appointment-reminders/ar-booking-admin-catalog'
import { OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { cn } from '@/lib/utils'

export function ArBookingAdminHub({ className }: { className?: string }) {
  const sections = buildBookingAdminCatalog()

  return (
    <OpusDataSurface className={cn('p-4 md:p-5', className)}>
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">Scheduling administration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full Acuity-style booking tools. Each area opens the existing Scheduling workspace — same APIs and
          public booking flows, Opus shell navigation.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} aria-labelledby={`booking-admin-${section.title}`}>
            <h3 id={`booking-admin-${section.title}`} className="text-sm font-semibold text-foreground">
              {section.title}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{section.description}</p>
            <ul className="mt-3 divide-y rounded-lg border border-border bg-card">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-start gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{link.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{link.description}</span>
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </OpusDataSurface>
  )
}
