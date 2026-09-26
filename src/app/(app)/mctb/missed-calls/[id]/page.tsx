import { MctbMissedCallDetailView } from "@/components/mctb/missed-call-detail-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbMissedCallsIdPage } from "@/newui-transplant/mirror/routes/mctb/missed-calls/[id]/page";
import { Suspense } from "react";

export default async function MctbMissedCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbMissedCallsIdPage params={params} />;
  }
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
