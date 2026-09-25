import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbAiLeadRecoveryLegacyRoute() {
  redirect(MCTB_ROUTES.aiRecovery);
}
