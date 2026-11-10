import { permanentRedirect } from 'next/navigation'
import { routes } from '../../../../../lib/routes'

export default async function LegacyAiVideoProjectRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectId } = await params
  permanentRedirect(routes.aiVideo(projectId, await searchParams))
}
