import { MctbMissedCallDetailView } from "@/components/mctb/missed-call-detail-view";
import { Suspense } from "react";

export default async function MctbMissedCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="px-6 py-12 text-sm text-muted-foreground">Loading missed call…</div>
      }
    >
      <MctbMissedCallDetailView eventId={id} />
    </Suspense>
  );
}
