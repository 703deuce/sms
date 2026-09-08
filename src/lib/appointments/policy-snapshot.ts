import type {
  AppointmentTypeConfig,
  CancellationPolicy,
  ReschedulePolicy,
} from "@/lib/appointments/types";
import type { ExtendedCancellationPolicy } from "@/lib/appointments/service-booking/types";

export type PolicySnapshot = {
  capturedAt: string;
  cancellation: CancellationPolicy;
  reschedule: ReschedulePolicy;
  extendedCancellation?: ExtendedCancellationPolicy;
  extendedReschedule?: import("@/lib/appointments/service-booking/types").ExtendedReschedulePolicy;
  paymentMode?: string;
  version: string;
};

export function buildPolicySnapshot(config: AppointmentTypeConfig): PolicySnapshot {
  return {
    capturedAt: new Date().toISOString(),
    cancellation: config.cancellationPolicy || { allowed: "anytime" },
    reschedule: config.reschedulePolicy || { allowed: "anytime" },
    extendedCancellation: config.extendedCancellationPolicy,
    extendedReschedule: config.extendedReschedulePolicy,
    paymentMode: config.payment?.mode || "none",
    version: "v1",
  };
}

export function readPolicySnapshot(metadata: Record<string, unknown> | null | undefined): PolicySnapshot | null {
  const snap = metadata?.policySnapshot;
  if (!snap || typeof snap !== "object") return null;
  return snap as PolicySnapshot;
}
