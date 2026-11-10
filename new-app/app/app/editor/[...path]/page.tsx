import { permanentRedirect } from 'next/navigation'
import { withQuery } from '../../../../lib/routes'

export default async function LegacyEditorPathRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { path } = await params
  permanentRedirect(withQuery(`/app/video-editor/${path.join('/')}`, await searchParams))
}
