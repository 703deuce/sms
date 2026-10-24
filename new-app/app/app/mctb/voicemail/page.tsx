import Link from 'next/link'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { buttonVariants } from '@/components/ui/button'
import { MctbVoicemailInbox } from '@/components/mctb/mctb-voicemail-inbox'

export const metadata = { title: 'Voicemail · Missed Call Text Back' }

export default function MctbVoicemailPage() {
  return (
    <Page>
      <PageHeader
        title="Voicemail"
        description="Listen to caller messages, transcripts, and summaries from your MCTB business line."
        actions={
          <Link href="/app/mctb/setup" className={buttonVariants({ variant: 'outline' })}>
            MCTB setup
          </Link>
        }
      />
      <MctbVoicemailInbox />
    </Page>
  )
}
