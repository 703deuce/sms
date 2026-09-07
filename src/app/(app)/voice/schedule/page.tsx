import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceSchedulePage() {
  redirect(MCTB_ROUTES.setupRecovery);
}
