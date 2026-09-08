import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbFollowUpLegacyRedirect() {
  redirect(MCTB_ROUTES.setupRecovery);
}
