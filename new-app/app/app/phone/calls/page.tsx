import Link from 'next/link'
import { Grid3x3 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { CallsTable } from '@/components/calls/calls-table'

export const metadata = { title: 'Calls · Phone' }

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  return (
    <Page>
      <PageHeader
        title="Calls"
        description="Every inbound and outbound call on your business lines, including voicemail and recordings. AI and text-back events are linked on each call."
        actions={
          <Link href="/app/phone/dialer" className={buttonVariants()}>
            <Grid3x3 />
            Make a call
          </Link>
        }
      />
      <CallsTable variant="phone" basePath="/app/phone/calls" initialFilter={filter} />
    </Page>
  )
}
