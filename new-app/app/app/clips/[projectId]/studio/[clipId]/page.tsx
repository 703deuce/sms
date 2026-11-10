import { permanentRedirect } from 'next/navigation'
import { routes } from '../../../../../../lib/routes'

export default async function LegacyClipStudioRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; clipId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectId, clipId } = await params
  permanentRedirect(routes.studio(projectId, clipId, await searchParams))
}
