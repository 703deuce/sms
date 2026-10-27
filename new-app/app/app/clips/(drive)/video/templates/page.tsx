import { T2vTemplatesGallery } from '@/components/t2v/t2v-templates-gallery'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { notFound } from 'next/navigation'

export const metadata = { title: 'AI Video templates' }

export default async function T2vTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  if (!isT2vFeatureEnabled()) notFound()
  const { d } = await searchParams
  return <T2vTemplatesGallery draftId={d} />
}
