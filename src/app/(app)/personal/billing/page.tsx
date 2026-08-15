import { redirect } from "next/navigation";

/** Billing is account-level — reuse settings billing. */
export default function PersonalBillingRedirect() {
  redirect("/settings/billing");
}
