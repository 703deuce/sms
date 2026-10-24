import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/api-auth'
import { MctbMissedCallDetailView } from '@/components/mctb/missed-call-detail-view'
import { loadMctbMissedCallDetail } from '@/lib/server/mctb/missed-call-detail'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await requireSession()
  const { id } = await params
  const detail = await loadMctbMissedCallDetail(workspaceId, id)
  if (!detail) notFound()
  return <MctbMissedCallDetailView detail={detail} />
}
