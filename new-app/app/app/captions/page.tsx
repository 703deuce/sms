import { Page, PageHeader } from '@/components/app/page-primitives'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'AI Captions' }

export default function AiCaptionsPage() {
  return (
    <Page>
      <PageHeader
        title="AI Captions"
        description="Upload a finished video, or pick an existing project, and generate captions. No clipping."
      />
      <p className="max-w-xl text-sm text-muted-foreground">
        Captions start automatically. When the run is ready, open the clip editor on the Captions tab
        to edit words and timing, then download a burned-in MP4 and an SRT. The clipper is unchanged.
      </p>
    </Page>
  )
}
