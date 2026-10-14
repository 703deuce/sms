"use client";

import { CampaignsCalendarOpus } from "@/newui-transplant/components/campaigns/campaigns-calendar-opus";
import { CampaignsOpusShell } from "@/newui-transplant/connected/campaigns/campaigns-opus-shell";

export default function CampaignCalendarPage() {
  return (
    <CampaignsOpusShell wide>
      <CampaignsCalendarOpus />
    </CampaignsOpusShell>
  );
}
