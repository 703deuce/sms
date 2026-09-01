import { redirect } from "next/navigation";

/** Legacy analytics route → new SMS Analytics hub. */
export default function AnalyticsRedirectPage() {
  redirect("/sms/analytics");
}
