import Link from 'next/link'
import { Upload } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, Page, PageHeader } from '@/components/app/page-primitives'

export const metadata = { title: 'Projects · Clips' }

export default function ClipsProjectsPage() {
  return (
    <Page>
      <PageHeader
        title="Projects"
        description="Upload long-form video and get short clips ready to post."
        actions={
          <Link href="/app/clips/new" className={buttonVariants({ size: 'sm' })}>
            <Upload />
            New project
          </Link>
        }
      />
      <EmptyState
        icon={Upload}
        title="No projects yet"
        description="Upload a podcast, interview or vlog to generate vertical clips with speaker-follow crop and captions."
        action={
          <Link href="/app/clips/new" className={buttonVariants()}>
            Upload a video
          </Link>
        }
      />
    </Page>
  )
}
