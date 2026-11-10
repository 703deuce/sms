import { Page, PageHeader } from '@/components/app/page-primitives'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'YouTube video' }

export default function YoutubeVideoPage() {
  return (
    <Page>
      <PageHeader
        title="Make a YouTube video"
        description="Turn a long recording into one long-form video. Uploads first; Twitch or Kick links use the existing import."
      />
      <p className="max-w-xl text-sm text-muted-foreground">
        This page starts a YouTube video run, waits for story options, then opens the finished
        video in the clip editor. The clipper at /app/clips is unchanged.
      </p>
    </Page>
  )
}
