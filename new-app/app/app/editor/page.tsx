import { permanentRedirect } from 'next/navigation'
import { routes, withQuery } from '../../../lib/routes'

export default async function LegacyEditorHubRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  permanentRedirect(withQuery(routes.videoEditor(), await searchParams))
}
