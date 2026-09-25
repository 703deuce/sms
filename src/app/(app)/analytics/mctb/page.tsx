import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Legacy analytics path — canonical MCTB analytics is /mctb/analytics */
export default function AnalyticsMctbLegacyRedirect() {
  redirect(MCTB_ROUTES.analytics);
}
