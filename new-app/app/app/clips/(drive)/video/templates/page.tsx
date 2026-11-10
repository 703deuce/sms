import { permanentRedirect } from 'next/navigation'
import { routes } from '../../../../../../lib/routes'

export default async function LegacyAiVideoTemplatesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  permanentRedirect(routes.aiVideoTemplates(await searchParams))
}
