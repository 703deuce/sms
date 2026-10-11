'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { PageHeader } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'

export type ArRemindersHubTab = 'activity' | 'sequences' | 'templates'

const TABS: Array<{ id: ArRemindersHubTab; label: string; href: string }> = [
  { id: 'activity', label: 'Activity & delivery', href: AR_ROUTES.reminders },
  { id: 'sequences', label: 'Sequences', href: AR_ROUTES.remindersSequences },
  { id: 'templates', label: 'Templates', href: AR_ROUTES.remindersTemplates },
]

export function ArRemindersHubShell({
  tab,
  title,
  description,
  children,
}: {
  tab: ArRemindersHubTab
  title?: string
  description?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const resolvedTab =
    TABS.find((t) => t.id === tab)?.id ??
    (pathname.startsWith(AR_ROUTES.remindersSequences)
      ? 'sequences'
      : pathname.startsWith(AR_ROUTES.remindersTemplates)
        ? 'templates'
        : 'activity')

  return (
    <ArOpusPage>
      <PageHeader
        title={title ?? 'Reminders'}
        description={
          description ??
          'Delivery activity, timed sequences, and approved message templates — separate from account settings.'
        }
      />
      <nav
        className="mb-6 flex gap-1 overflow-x-auto border-b"
        aria-label="Reminders sections"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              resolvedTab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </ArOpusPage>
  )
}
