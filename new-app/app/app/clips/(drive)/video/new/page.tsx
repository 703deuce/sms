import { permanentRedirect } from 'next/navigation'
import { routes } from '../../../../../../lib/routes'

export default async function LegacyAiVideoNewRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  permanentRedirect(routes.aiVideoNew(await searchParams))
}
