import { Page } from '@/components/app/page-primitives'
import { VoicemailWorkspace } from '@/components/phone/voicemail-workspace'

export const metadata = { title: 'Voicemail · Phone' }

export default function PhoneVoicemailPage() {
  return (
    <Page>
      <VoicemailWorkspace />
    </Page>
  )
}
