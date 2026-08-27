import { redirect } from "next/navigation";

export default function InboxArchivedRedirect() {
  redirect("/conversations?filter=archived");
}
