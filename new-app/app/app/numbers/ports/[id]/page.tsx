import { PortDetail } from '@/components/numbers/number-details'

export default async function PortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PortDetail id={id} />
}
