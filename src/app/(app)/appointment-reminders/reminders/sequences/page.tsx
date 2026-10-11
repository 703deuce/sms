import { Suspense } from 'react'
import { ArRemindersSequencesPage } from '@/newui-transplant/connected/appointment-reminders/ar-reminders-sequences-page'

export default function ArRemindersSequencesRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sequences…</p>}>
      <ArRemindersSequencesPage />
    </Suspense>
  )
}
