import { Suspense } from 'react'
import { ArRemindersTemplatesPage } from '@/newui-transplant/connected/appointment-reminders/ar-reminders-templates-page'

export default function ArRemindersTemplatesRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading templates…</p>}>
      <ArRemindersTemplatesPage />
    </Suspense>
  )
}
