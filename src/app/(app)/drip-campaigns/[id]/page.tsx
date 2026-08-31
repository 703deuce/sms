import { redirect } from "next/navigation";
import { dripCampaignDetailHref } from "@/lib/drip-campaigns/routes";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyDripCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(dripCampaignDetailHref(id));
}
