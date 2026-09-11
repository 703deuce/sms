import { redirect } from "next/navigation";

export default function LegacyMeetingsListRedirect() {
  redirect("/appointments/meetings");
}
