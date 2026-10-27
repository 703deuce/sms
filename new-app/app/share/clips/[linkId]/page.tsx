import { notFound } from 'next/navigation'
import { ShareClipViewer } from '@/components/script-editor/share/share-clip-viewer'
import { resolveShareLinkById } from '@/lib/server/clips/composition-share'

export const metadata = { title: 'Shared video' }

export default async function ShareClipLinkPage({ params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params
  const link = await resolveShareLinkById(linkId)
  if (!link || link.linkAccess === 'INVITE_ONLY') notFound()

  return (
    <ShareClipViewer
      title={link.composition.title}
      projectId={link.composition.projectId}
      compositionId={link.composition.id}
      mode={link.linkAccess === 'LINK_COMMENT' ? 'comment' : 'view'}
    />
  )
}
