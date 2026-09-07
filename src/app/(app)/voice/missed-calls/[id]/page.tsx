import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default async function VoiceMissedCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(MCTB_ROUTES.missedCallDetail(id));
}
