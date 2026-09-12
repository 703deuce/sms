import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { redirect } from "next/navigation";

/** Legacy URL — canonical visual voicemail inbox is PersonalVoicemailUI. */
export default async function MctbVoicemailLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; numberId?: string; from?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.id) q.set("id", params.id);
  if (params.numberId) q.set("numberId", params.numberId);
  if (params.from) q.set("from", params.from);
  const qs = q.toString();
  redirect(qs ? `${MCTB_ROUTES.voicemail}?${qs}` : MCTB_ROUTES.voicemail);
}
