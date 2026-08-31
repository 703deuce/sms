import { redirect } from "next/navigation";
import { dripCampaignEditHref } from "@/lib/drip-campaigns/routes";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyEditDripCampaignPage({ params }: Props) {
  const { id } = await params;
  redirect(dripCampaignEditHref(id));
}
