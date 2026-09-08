import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function VoiceConversationsRedirect() {
  redirect(MCTB_ROUTES.conversations);
}
