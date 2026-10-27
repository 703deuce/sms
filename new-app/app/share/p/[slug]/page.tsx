import { notFound } from 'next/navigation'
import { ShareClipViewer } from '@/components/script-editor/share/share-clip-viewer'
import { getPublishBySlug } from '@/lib/server/clips/composition-share'

export const metadata = { title: 'Published video' }

export default async function PublishedClipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pub = await getPublishBySlug(slug)
  if (!pub) notFound()

  const settings = (pub.settings ?? {}) as { allowComments?: boolean }
  return (
    <ShareClipViewer
      title={pub.composition.title}
      projectId={pub.composition.projectId}
      compositionId={pub.composition.id}
      mode={settings.allowComments ? 'comment' : 'view'}
      viewCount={pub.viewCount}
    />
  )
}
