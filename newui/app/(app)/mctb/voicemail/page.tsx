import type { Metadata } from 'next'
import { Page, PageHeader } from '@/components/app/kit'
import { ButtonLink } from '@/components/app/button-link'
import { VoicemailBrowser } from '@/components/mctb/voicemail-browser'

export const metadata: Metadata = { title: 'Voicemail' }

export default function VoicemailPage() {
  return (
    <Page>
      <PageHeader
        title="Voicemail"
        description="Messages callers left after a missed call."
        actions={<ButtonLink href="/mctb/setup/voicemail" variant="outline">Voicemail settings</ButtonLink>}
      />
      <VoicemailBrowser />
    </Page>
  )
}
