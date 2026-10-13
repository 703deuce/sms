'use client'

import { AnalyticsClient } from '@/components/appointments/kimi-ui/analytics/components/analytics-client'
import type { AppointmentsAnalyticsSection } from '@/lib/products/appointments-settings-tabs'
import { appointmentsAnalyticsTabs } from '@/lib/products/appointments-settings-tabs'
import { SchedulingOpusShell } from '@/newui-transplant/connected/scheduling/scheduling-opus-shell'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function hrefForSection(section: AppointmentsAnalyticsSection): string {
  if (section === 'overview') return '/appointments/analytics'
  return `/appointments/analytics/${section}`
}

export function AppointmentsAnalyticsOpusShell({
  section = 'overview',
}: {
  section?: AppointmentsAnalyticsSection
}) {
  const activeHref = hrefForSection(section)

  return (
    <SchedulingOpusShell
      title="Scheduling analytics"
      description="Bookings, reminders, automations, and operational reports."
    >
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Analytics sections">
        {appointmentsAnalyticsTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              tab.href === activeHref
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <AnalyticsClient section={section} />
    </SchedulingOpusShell>
  )
}
