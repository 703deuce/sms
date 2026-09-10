import { Suspense } from "react";
import { KimiCampaignsConnected } from "@/components/campaigns/kimi-campaigns-connected";
import { mapBroadcastRowToListRow } from "@/lib/campaigns/kimi-campaigns-adapter";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listBroadcastCampaigns } from "@/lib/mass-texting/broadcast/service";
import { loadAppointmentsCampaignsSenderStatus } from "@/lib/mass-texting/appointments-campaigns-page";

export default async function AppointmentsCampaignsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const [initialRows, senderStatus] = workspaceId
    ? await Promise.all([
        listBroadcastCampaigns(workspaceId, { take: 200 }).then((rows) =>
          rows.map(mapBroadcastRowToListRow),
        ),
        loadAppointmentsCampaignsSenderStatus(workspaceId),
      ])
    : [[], null];

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <KimiCampaignsConnected initialRows={initialRows} senderStatus={senderStatus} />
    </Suspense>
  );
}
