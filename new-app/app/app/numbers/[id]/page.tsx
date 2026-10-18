import { OwnedNumberDetail } from '@/components/numbers/number-details'

export default async function NumberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OwnedNumberDetail id={id} />
}
