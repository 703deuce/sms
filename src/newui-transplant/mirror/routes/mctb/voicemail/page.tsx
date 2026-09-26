import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { VoicemailBrowser } from '@/newui-transplant/components/mctb/voicemail-browser'


export function TransplantMctbVoicemailPage() {
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
