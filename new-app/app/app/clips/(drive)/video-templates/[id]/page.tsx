import { notFound } from 'next/navigation'
import { VideoTemplateStudio } from '@/components/clips/templates/video-template-studio'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
export const dynamic = 'force-dynamic'
export default async function VideoTemplateDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ draft?: string }>
}) {
  const { id } = await params
  const { draft } = await searchParams
  const release = FIRST_PARTY_VIDEO_TEMPLATES.find(t => t.id === id)
  if (!release) notFound()
  return <VideoTemplateStudio release={release} initialProjectId={draft} />
}
