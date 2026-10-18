import { ConnectionDetail } from '@/components/numbers/number-details'

export default async function ConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConnectionDetail id={id} />
}
