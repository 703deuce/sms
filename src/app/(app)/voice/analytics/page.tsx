import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceAnalyticsPage() {
  redirect(MCTB_ROUTES.analytics);
}
