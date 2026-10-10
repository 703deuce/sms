import { redirect } from "next/navigation";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

export default function HeldInboundLegacyRedirect() {
  redirect(`${AR_ROUTES.responses}?view=held`);
}
