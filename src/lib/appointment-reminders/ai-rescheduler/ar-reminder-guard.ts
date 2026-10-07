import type { AppointmentMetadata } from "@/lib/appointments/types";

type MetaWithAr = AppointmentMetadata & {
  arReconcilePending?: { operationId?: string };
  arRemindersHeld?: boolean;
  arDurableOperation?: { status?: string };
};

/** Hold outbound reminders while provider/local appointment state may disagree. */
export function shouldHoldRemindersForAppointment(metadata: AppointmentMetadata | null | undefined): boolean {
  const meta = (metadata || {}) as MetaWithAr;
  if (meta.arRemindersHeld) return true;
  if (meta.arReconcilePending) return true;
  const durable = meta.arDurableOperation;
  if (durable?.status === "provider_succeeded_local_pending") return true;
  if (durable?.status === "processing") return true;
  return false;
}
