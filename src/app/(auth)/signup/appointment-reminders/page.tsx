import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AppointmentRemindersSignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  qs.set("product", "appointment_reminders");
  const plan = typeof params.plan === "string" ? params.plan : "free";
  qs.set("plan", plan);
  const next =
    typeof params.next === "string"
      ? params.next
      : "/api/appointment-reminders/product-open?plan=free&next=/appointment-reminders/setup/connect";
  qs.set("next", next);
  redirect(`/signup?${qs.toString()}`);
}
