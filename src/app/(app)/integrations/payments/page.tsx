import { redirect } from "next/navigation";

/** Legacy route — canonical integrations page owns payment processors. */
export default function PaymentsIntegrationsRedirectPage() {
  redirect("/integrations?provider=stripe");
}
