import Link from 'next/link'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { buttonVariants } from '@/components/ui/button'

export const metadata = { title: 'Voicemail · Missed Call Text Back' }

export default function MctbVoicemailPage() {
  return (
    <Page>
      <PageHeader
        title="Voicemail"
        description="MCTB voicemail greetings and inbox messages are tied to your business line configuration."
        actions={
          <Link href="/app/phone/voicemail" className={buttonVariants({ variant: 'outline' })}>
            Open phone voicemail settings
          </Link>
        }
      />
      <p className="text-sm text-muted-foreground">
        Operational voicemail for MCTB runs on the same recording pipeline as your assigned business number. Use Setup to
        confirm the line, then manage greeting and messages from Phone → Voicemail until the dedicated MCTB voicemail
        inbox view is fully ported in this shell.
      </p>
    </Page>
  )
}
