import { Suspense } from "react";
import { KimiCampaignsConnected } from "@/components/campaigns/kimi-campaigns-connected";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadAppointmentsCampaignsSenderStatus } from "@/lib/mass-texting/appointments-campaigns-page";

export default async function AppointmentsReviewCampaignPage() {
  const workspaceId = await getActiveWorkspaceId();
  const senderStatus = await loadAppointmentsCampaignsSenderStatus(workspaceId);

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <KimiCampaignsConnected initialView="review" senderStatus={senderStatus} />
    </Suspense>
  );
}
