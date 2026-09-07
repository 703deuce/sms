import { MctbMissedCallDetailView } from "@/components/mctb/missed-call-detail-view";

export default async function MctbMissedCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MctbMissedCallDetailView eventId={id} />;
}
