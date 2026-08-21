import { redirect } from "next/navigation";

/** Legacy John agent UI → missed call activity log. */
export default function AgentsJohnRedirectPage() {
  redirect("/voice/missed-calls");
}
