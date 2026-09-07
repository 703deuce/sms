import { redirect } from "next/navigation";

/** MCTB Conversations — canonical shared inbox with MCTB product filter. */
export default function MctbConversationsPage() {
  redirect("/conversations?product=mctb");
}
