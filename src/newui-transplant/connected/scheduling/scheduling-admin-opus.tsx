'use client'

import type { ReactNode } from 'react'
import { SchedulingOpusPage } from '@/newui-transplant/connected/scheduling/scheduling-opus-page'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'

/** Opus shell + functional body (body must not render its own page title when used with suppressChrome). */
export function schedulingAdminGate(
  title: string,
  description: string,
  legacy: ReactNode,
  opusBody: ReactNode,
) {
  return (
    <SchedulingPageGate
      opus={
        <SchedulingOpusPage title={title} description={description}>
          {opusBody}
        </SchedulingOpusPage>
      }
      legacy={legacy}
    />
  )
}
