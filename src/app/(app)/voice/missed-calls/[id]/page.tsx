import { MctbMissedCallDetailView } from "@/components/mctb/missed-call-detail-view";

type Props = { params: Promise<{ id: string }> };

export default async function MctbMissedCallDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <MctbMissedCallDetailView eventId={id} />
    </div>
  );
}
