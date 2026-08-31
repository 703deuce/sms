import { Suspense } from "react";
import { KimiSegmentsConnected } from "@/components/contacts/kimi-segments-connected";
import { mapApiSegmentToKimi } from "@/lib/contacts/kimi-segments-adapter";
import { loadSegments, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function ContactsSegmentsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const segments = await loadSegments(workspaceId);

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-contacts-segments">
        <KimiSegmentsConnected initialSegments={segments.map((s) => mapApiSegmentToKimi(s))} />
      </div>
    </Suspense>
  );
}
