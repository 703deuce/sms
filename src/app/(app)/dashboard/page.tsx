import { redirect } from "next/navigation";

/** Legacy /dashboard URL — canonical SMS dashboard is /sms/dashboard. */
export default function DashboardPage() {
  redirect("/sms/dashboard");
}
