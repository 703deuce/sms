import { T2vTemplatesGallery } from '@/components/t2v/t2v-templates-gallery'
import { requireAiVideoPageEnabled } from '@/lib/server/t2v/require-ai-video-page'

export const metadata = { title: 'AI Video templates' }

export default async function T2vTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  requireAiVideoPageEnabled()
  const { d } = await searchParams
  return <T2vTemplatesGallery draftId={d} />
}
