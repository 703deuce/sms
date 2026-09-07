import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceSetupPage() {
  redirect(MCTB_ROUTES.setup);
}
