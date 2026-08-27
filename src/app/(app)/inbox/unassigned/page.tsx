import { redirect } from "next/navigation";

export default function InboxUnassignedRedirect() {
  redirect("/conversations?filter=unassigned");
}
