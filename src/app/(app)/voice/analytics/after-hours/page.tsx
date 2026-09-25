import { redirect } from "next/navigation";

/** After-hours metrics use the same Voice analytics API (outcome + transfer breakdown). */
export default function VoiceAfterHoursAnalyticsPage() {
  redirect("/voice/analytics");
}
