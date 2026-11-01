import { notFound } from 'next/navigation'
import { ShareRenderViewer } from '@/components/clips/share-render-viewer'
import { resolveRenderSharePage } from '@/lib/server/clips/render-share'

export const metadata = { title: 'Shared export' }

export default async function ShareRenderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const row = await resolveRenderSharePage(slug)
  if (!row) notFound()
  return <ShareRenderViewer slug={slug} />
}
