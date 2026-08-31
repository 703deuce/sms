import { redirect } from "next/navigation";
import { dripCampaignNewHref } from "@/lib/drip-campaigns/routes";

export default function LegacyNewDripCampaignPage() {
  redirect(dripCampaignNewHref());
}
