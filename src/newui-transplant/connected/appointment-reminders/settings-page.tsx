'use client'

import { Suspense, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import {
  AppointmentRemindersSettingsOpus,
  type ArSettingsTab,
} from '@/newui-transplant/connected/appointment-reminders/reminder-settings-opus'
import { cn } from '@/lib/utils'

const TAB_LINKS: Array<{ id: ArSettingsTab; label: string }> = [
  { id: 'sequence', label: 'Reminder sequence' },
  { id: 'templates', label: 'Templates' },
  { id: 'scheduling', label: 'Scheduling & rules' },
  { id: 'business', label: 'Business profile' },
  { id: 'notifications', label: 'Notifications & responses' },
  { id: 'integrations', label: 'Integrations' },
]

function SettingsPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get('tab')
  const activeTab: ArSettingsTab =
    raw && TAB_LINKS.some((t) => t.id === raw) ? (raw as ArSettingsTab) : 'sequence'

  const setTab = useCallback(
    (tab: ArSettingsTab) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('tab', tab)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <Page className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Settings"
        description="Reminder sequence, templates, scheduling rules, business profile, and integrations."
      />
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
    </Page>
  )
}

export function AppointmentRemindersSettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
      <SettingsPageInner />
    </Suspense>
  )
}
