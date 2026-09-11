import { redirect } from "next/navigation";

export default function LegacyMeetingsNewRedirect() {
  redirect("/appointments/meetings/new");
}
