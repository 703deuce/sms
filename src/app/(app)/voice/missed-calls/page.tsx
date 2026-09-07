import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceMissedCallsPage() {
  redirect(MCTB_ROUTES.missedCalls);
}
