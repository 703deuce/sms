import { redirect } from "next/navigation";

export default function InboxUnassignedRedirect() {
  redirect("/inbox?tab=unassigned");
}
