import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceConsentLogPage() {
  redirect(MCTB_ROUTES.complianceConsent);
}
