import { redirect } from 'next/navigation'

/** Legacy path — middleware also redirects to /app/exports */
export default async function ClipsExportsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  redirect(`/app/exports${q}`)
}
