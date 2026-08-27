import { redirect } from "next/navigation";

export default function InboxMineRedirect() {
  redirect("/conversations?filter=mine");
}
