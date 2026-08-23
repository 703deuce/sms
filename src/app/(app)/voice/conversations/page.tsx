import { redirect } from "next/navigation";

/** SMS recovery threads live in Inbox — voice call rollup was misleading here. */
export default function VoiceConversationsPage() {
  redirect("/inbox");
}
