import { redirect } from "next/navigation";

/** Legacy receptionist hub → MCTB setup. */
export default function VoiceReceptionistRedirectPage() {
  redirect("/voice/setup");
}
