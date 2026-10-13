'use client'

import type { ReactNode } from 'react'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { PageHeader } from '@/newui-transplant/components/app/kit'

export function SchedulingOpusPage({
  title,
  description,
  actions,
  meta,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <ArOpusPage>
      <PageHeader title={title} description={description} actions={actions} meta={meta} />
      {children}
    </ArOpusPage>
  )
}
