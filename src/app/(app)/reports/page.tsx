import { redirect } from "next/navigation";

/** Legacy reports overview → new SMS Analytics hub. */
export default function ReportsOverviewRedirect() {
  redirect("/sms/analytics");
}
