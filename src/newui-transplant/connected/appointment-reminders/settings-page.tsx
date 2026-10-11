'use client'

import { Suspense, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/newui-transplant/components/app/kit'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  AppointmentRemindersSettingsOpus,
  type ArSettingsTab,
} from '@/newui-transplant/connected/appointment-reminders/reminder-settings-opus'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { cn } from '@/lib/utils'

const TAB_LINKS: Array<{ id: ArSettingsTab; label: string }> = [
  { id: 'scheduling', label: 'Scheduling & rules' },
  { id: 'business', label: 'Business profile' },
  { id: 'notifications', label: 'Notifications & responses' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'billing', label: 'Plan & billing' },
]

function SettingsPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get('tab')
  const activeTab: ArSettingsTab =
    raw && TAB_LINKS.some((t) => t.id === raw) ? (raw as ArSettingsTab) : 'scheduling'

  useEffect(() => {
    if (raw === 'sequence') {
      router.replace(AR_ROUTES.remindersSequences)
      return
    }
    if (raw === 'templates') {
      router.replace(AR_ROUTES.remindersTemplates)
      return
    }
    if (!raw) {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('tab', 'scheduling')
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    }
  }, [raw, router, pathname, searchParams])

  const setTab = useCallback(
    (tab: ArSettingsTab) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('tab', tab)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <ArOpusPage>
      <PageHeader
        title="Settings"
        description="Scheduling rules, business profile, notifications, and calendar integrations. Sequences and templates live under Reminders."
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Manage your{' '}
        <Link href={AR_ROUTES.remindersSequences} className="font-medium text-foreground underline">
          reminder sequence
        </Link>{' '}
        and{' '}
        <Link href={AR_ROUTES.remindersTemplates} className="font-medium text-foreground underline">
          template library
        </Link>{' '}
        from the Reminders area.
      </p>
      <nav
        className="mb-6 flex gap-1 overflow-x-auto border-b pb-0"
        aria-label="Reminder settings sections"
      >
        {TAB_LINKS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <AppointmentRemindersSettingsOpus activeTab={activeTab} />
    </ArOpusPage>
  )
}

export function AppointmentRemindersSettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
      <SettingsPageInner />
    </Suspense>
  )
}
