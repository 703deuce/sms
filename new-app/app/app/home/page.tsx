import { permanentRedirect } from 'next/navigation'
import { routes, withQuery } from '../../../lib/routes'

export default async function HomeRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  permanentRedirect(withQuery(routes.app(), await searchParams))
}
