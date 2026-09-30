import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Legacy Voice analytics → canonical MCTB analytics. */
export default function VoiceAnalyticsPage() {
  redirect(MCTB_ROUTES.analytics);
}
