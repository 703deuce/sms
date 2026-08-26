import { redirect } from "next/navigation";

/** MCTB recovery threads live in shared Inbox — preserve product filter. */
export default function VoiceConversationsPage() {
  redirect("/inbox?product=mctb");
}
