import { Suspense } from 'react'
import { ArSequenceStepEditorPage } from '@/newui-transplant/connected/appointment-reminders/ar-sequence-step-editor-page'

type Props = { params: Promise<{ stepKey: string }> }

export default async function ArSequenceStepEditorRoute({ params }: Props) {
  const { stepKey } = await params
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading editor…</p>}>
      <ArSequenceStepEditorPage stepKey={decodeURIComponent(stepKey)} />
    </Suspense>
  )
}
