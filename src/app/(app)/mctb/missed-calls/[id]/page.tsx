import { MctbMissedCallDetailView } from "@/components/mctb/missed-call-detail-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbMissedCallDetailPage } from "@/newui-transplant/connected/mctb/missed-call-detail-page";
import { Suspense } from "react";

export default async function MctbMissedCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbMissedCallDetailPage eventId={id} />;
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
