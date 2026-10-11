'use client'

import { useRouter } from 'next/navigation'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { AppointmentRemindersSettingsOpus } from '@/newui-transplant/connected/appointment-reminders/reminder-settings-opus'

export function ArSequenceStepEditorPage({ stepKey }: { stepKey: string }) {
  const router = useRouter()
  return (
    <AppointmentRemindersSettingsOpus
      presentation="step-editor-page"
      fullPageStepKey={stepKey}
      onBackFromStepEditor={() => router.push(AR_ROUTES.remindersSequences)}
    />
  )
}
