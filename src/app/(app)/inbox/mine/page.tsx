import { redirect } from "next/navigation";

export default function InboxMineRedirect() {
  redirect("/inbox?tab=mine");
}
