'use client'

import type { ReactNode } from 'react'
import { OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { SchedulingOpusPage } from '@/newui-transplant/connected/scheduling/scheduling-opus-page'
import '@/newui-transplant/connected/scheduling/scheduling-opus-scope.css'

export type SchedulingOpusBodyProps = {
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
  children: ReactNode
}

/** Opus page chrome + scoped functional body (legacy logic, Opus presentation shell). */
export function SchedulingOpusBody({
  title,
  description,
  actions,
  meta,
  children,
}: SchedulingOpusBodyProps) {
  return (
    <SchedulingOpusPage title={title} description={description} actions={actions} meta={meta}>
      <OpusDataSurface className="scheduling-opus-scope min-w-0">{children}</OpusDataSurface>
    </SchedulingOpusPage>
  )
}
