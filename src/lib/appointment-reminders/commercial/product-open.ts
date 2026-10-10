import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { isArPlanKey, type ArPlanKey } from "@/lib/appointment-reminders/commercial/ar-plan-catalog";

export function appointmentRemindersProductOpenPath(input?: {
  plan?: string | null;
  next?: string | null;
}): string {
  const params = new URLSearchParams();
  const plan = input?.plan?.trim();
  if (plan && isArPlanKey(plan)) params.set("plan", plan);
  const next = input?.next?.trim();
  if (next && next.startsWith("/")) params.set("next", next);
  const qs = params.toString();
  return `/api/appointment-reminders/product-open${qs ? `?${qs}` : ""}`;
}

export function appointmentRemindersSignupPath(plan: ArPlanKey): string {
  return `/signup?product=appointment_reminders&plan=${plan}&next=${encodeURIComponent(AR_ROUTES.pricing)}`;
}
