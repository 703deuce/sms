import type { Metadata } from 'next'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/app/primitives'
import { VoicemailView } from '@/components/mctb/voicemail-view'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Voicemail' }

export default function VoicemailPage() {
  return (
    <>
      <PageHeader
        title="Voicemail"
        description="Recordings, transcripts, and AI summaries from callers who left a message."
        actions={
          <Link href="/mctb/setup/voicemail" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            <Settings2 aria-hidden="true" /> Voicemail settings
          </Link>
        }
      />
      <VoicemailView />
    </>
  )
}
