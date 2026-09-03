import { Suspense } from "react";
import { KimiCampaignsConnected } from "@/components/campaigns/kimi-campaigns-connected";
import { mapBroadcastRowToListRow } from "@/lib/campaigns/kimi-campaigns-adapter";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listBroadcastCampaigns } from "@/lib/mass-texting/broadcast/service";

export default async function Page() {
  const workspaceId = await getActiveWorkspaceId();
  const initialRows = workspaceId
    ? (await listBroadcastCampaigns(workspaceId, { take: 200 })).map(mapBroadcastRowToListRow)
    : [];

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <KimiCampaignsConnected initialRows={initialRows} />
    </Suspense>
  );
}
