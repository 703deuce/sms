'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Calendar } from 'lucide-react'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'

export function SchedulingOpusPage({
  icon: Icon = Calendar,
  title,
  description,
  actions,
  meta,
  children,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={Icon}
        title={title}
        description={description}
        actions={actions}
        meta={meta}
      />
      {children}
    </ArOpusPage>
  )
}
