import { redirect } from "next/navigation";
import { dripCampaignsListHref } from "@/lib/drip-campaigns/routes";

export default function LegacyDripCampaignsPage() {
  redirect(dripCampaignsListHref());
}
