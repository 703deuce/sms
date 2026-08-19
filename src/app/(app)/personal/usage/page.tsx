import { redirect } from "next/navigation";

/** Usage is surfaced under Billing for production launch — no standalone sidebar page. */
export default async function PersonalUsagePage() {
  redirect("/settings/billing");
}
