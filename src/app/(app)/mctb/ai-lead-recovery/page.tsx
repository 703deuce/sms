import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Legacy route — canonical AI Recovery configuration is /mctb/ai-recovery */
export default function MctbAiLeadRecoveryLegacyRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.set(key, value);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`${MCTB_ROUTES.aiRecovery}${suffix}`);
}
