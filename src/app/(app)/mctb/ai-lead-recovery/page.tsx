import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Legacy URL — canonical AI Recovery configuration. */
export default async function MctbAiLeadRecoveryLegacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `${MCTB_ROUTES.aiRecovery}?${suffix}` : MCTB_ROUTES.aiRecovery);
}
