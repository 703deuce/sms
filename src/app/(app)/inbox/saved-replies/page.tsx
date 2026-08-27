import { redirect } from "next/navigation";

export default function InboxSavedRepliesRedirect() {
  redirect("/conversations/saved-replies");
}
