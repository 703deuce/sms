import "server-only";

import { getPrisma } from "@/lib/db";
import { readPolicySnapshot } from "@/lib/appointments/policy-snapshot";
import type { PolicySnapshot } from "@/lib/appointments/policy-snapshot";

export type PolicyFeeResult = {
  charged: boolean;
  amountCents: number;
  reason?: string;
  provider?: "stripe" | "ledger";
  error?: string;
};

function resolveFeeCents(
  snapshot: PolicySnapshot | null,
  kind: "cancel" | "no_show",
  afterCutoff: boolean,
): number {
  if (!snapshot?.extendedCancellation && !snapshot?.cancellation) return 0;
  const ext = snapshot.extendedCancellation;
  if (kind === "cancel" && afterCutoff && ext?.lateFeeCents) {
    return ext.lateFeeCents;
  }
  if (kind === "no_show" && ext?.lateFeeCents) {
    return ext.lateFeeCents;
  }
  return 0;
}

/** Attempt policy fee charge on cancel/no-show. Records ledger when Stripe unavailable. */
export async function executePolicyFee(
  workspaceId: string,
  appointmentId: string,
  input: { kind: "cancel" | "no_show"; afterCutoff?: boolean },
): Promise<PolicyFeeResult> {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    select: { id: true, contactId: true, metadata: true, serviceName: true },
  });
  if (!appointment?.contactId) {
    return { charged: false, amountCents: 0, reason: "no_contact" };
  }

  const snapshot = readPolicySnapshot((appointment.metadata || {}) as Record<string, unknown>);
  const amountCents = resolveFeeCents(snapshot, input.kind, Boolean(input.afterCutoff));
  if (amountCents <= 0) {
    return { charged: false, amountCents: 0, reason: "no_fee_configured" };
  }

  try {
    const { chargeSavedCardForAppointment } = await import("@/lib/merchant-payments/saved-cards");
    const charge = await chargeSavedCardForAppointment({
      workspaceId,
      appointmentId,
      contactId: appointment.contactId,
      payment: { mode: "full", priceCents: amountCents, currency: "usd" },
      description: `Policy fee — ${appointment.serviceName || "appointment"}`,
    });
    if (charge.succeeded) {
      return { charged: true, amountCents, provider: "stripe" };
    }
    if (charge.error && charge.configured) {
      throw new Error(charge.error);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "charge_failed";
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: {
          ...((appointment.metadata || {}) as object),
          policyFeePending: { kind: input.kind, amountCents, error: message },
        } as object,
      },
    });
    return { charged: false, amountCents, error: message };
  }

  try {
    const { debitWallet } = await import("@/lib/appointments/service-booking/phase2/client-wallet");
    await debitWallet(workspaceId, appointment.contactId, amountCents, {
      kind: "policy_fee",
      note: `${input.kind} fee for ${appointment.serviceName || "appointment"}`,
      referenceId: appointmentId,
    });
    return { charged: true, amountCents, provider: "ledger" };
  } catch {
    return { charged: false, amountCents, reason: "insufficient_wallet" };
  }
}
