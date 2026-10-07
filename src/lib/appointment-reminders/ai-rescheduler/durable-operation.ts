import "server-only";

import type { AppointmentMetadata } from "@/lib/appointments/types";
import { providerRefFromAppointment } from "./provider-mutations";

export type ArDurableOperationStatus =
  | "pending"
  | "processing"
  | "provider_succeeded_local_pending"
  | "completed"
  | "failed"
  | "ambiguous";

export type ArDurableOperationRecord = {
  operationId: string;
  kind: "reschedule" | "cancel";
  status: ArDurableOperationStatus;
  workspaceId: string;
  appointmentId: string;
  provider?: "google" | "microsoft";
  connectionId?: string;
  providerCalendarId?: string;
  providerEventId?: string;
  originalStartsAt: string;
  originalEndsAt: string;
  proposedStartsAt?: string;
  proposedEndsAt?: string;
  idempotencyKey: string;
  attemptCount: number;
  lastError?: string;
  providerReceiptAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function readArDurableOperation(
  meta: AppointmentMetadata & { arDurableOperation?: ArDurableOperationRecord },
): ArDurableOperationRecord | null {
  return meta.arDurableOperation || null;
}

export function beginArDurableReschedule(input: {
  meta: AppointmentMetadata;
  workspaceId: string;
  appointmentId: string;
  operationId: string;
  row: {
    externalId: string | null;
    startsAt: Date;
    endsAt: Date;
    metadata: unknown;
    timezone: string | null;
  };
  proposedStartsAt: string;
  proposedEndsAt: string;
}): AppointmentMetadata & { arDurableOperation: ArDurableOperationRecord; arRemindersHeld: boolean } {
  const ref = providerRefFromAppointment(input.row);
  const now = new Date().toISOString();
  const op: ArDurableOperationRecord = {
    operationId: input.operationId,
    kind: "reschedule",
    status: "processing",
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    provider: ref?.provider,
    connectionId: ref?.connectionId,
    providerCalendarId: ref?.providerCalendarId,
    providerEventId: ref?.providerEventId,
    originalStartsAt: input.row.startsAt.toISOString(),
    originalEndsAt: input.row.endsAt.toISOString(),
    proposedStartsAt: input.proposedStartsAt,
    proposedEndsAt: input.proposedEndsAt,
    idempotencyKey: input.operationId,
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...input.meta,
    arDurableOperation: op,
    arRemindersHeld: true,
  };
}

export function markArDurableProviderSucceeded(
  meta: AppointmentMetadata & { arDurableOperation?: ArDurableOperationRecord },
): AppointmentMetadata {
  const op = meta.arDurableOperation;
  if (!op) return meta;
  return {
    ...meta,
    arDurableOperation: {
      ...op,
      status: "provider_succeeded_local_pending",
      providerReceiptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    arRemindersHeld: true,
  };
}

export function markArDurableCompleted(
  meta: AppointmentMetadata & { arDurableOperation?: ArDurableOperationRecord },
): AppointmentMetadata {
  const op = meta.arDurableOperation;
  if (!op) {
    return { ...meta, arRemindersHeld: false };
  }
  return {
    ...meta,
    arRemindersHeld: false,
    arDurableOperation: {
      ...op,
      status: "completed",
      updatedAt: new Date().toISOString(),
    },
  };
}

export function markArDurableFailed(
  meta: AppointmentMetadata & { arDurableOperation?: ArDurableOperationRecord },
  message: string,
): AppointmentMetadata {
  const op = meta.arDurableOperation;
  if (!op) return meta;
  return {
    ...meta,
    arRemindersHeld: false,
    arDurableOperation: {
      ...op,
      status: "failed",
      lastError: message,
      attemptCount: op.attemptCount + 1,
      updatedAt: new Date().toISOString(),
    },
  };
}
