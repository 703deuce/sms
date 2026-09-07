import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Legacy John agent UI → missed call activity log. */
export default function AgentsJohnRedirectPage() {
  redirect(MCTB_ROUTES.missedCalls);
}
