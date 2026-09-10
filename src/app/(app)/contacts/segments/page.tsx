import { Suspense } from "react";
import { AppointmentSegmentPresetsPanel } from "@/components/contacts/appointment-segment-presets-panel";
import { KimiSegmentsConnected } from "@/components/contacts/kimi-segments-connected";
import { mapApiSegmentToKimi } from "@/lib/contacts/kimi-segments-adapter";
import { countSegmentContacts } from "@/lib/contacts/segment-query";
import { loadSegments, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function ContactsSegmentsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const segments = await loadSegments(workspaceId);
  const initialSegments = await Promise.all(
    segments.map(async (s) =>
      mapApiSegmentToKimi(s, await countSegmentContacts(workspaceId, s.conditions)),
    ),
  );

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-contacts-segments">
        <AppointmentSegmentPresetsPanel />
        <KimiSegmentsConnected initialSegments={initialSegments} />
      </div>
    </Suspense>
  );
}
