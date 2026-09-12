import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { redirect } from "next/navigation";

/** Legacy URL — consolidated into Recovery. */
export default function MctbSetupMissedCallRulesPage() {
  redirect(MCTB_ROUTES.setupRecovery);
}
