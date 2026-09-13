import "server-only";

import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
export type ConnectTenantContext = {
  workspaceId: string;
  connectedAccountId: string;
};

/**
 * Resolve workspace from Connect webhook event.account (canonical tenant boundary).
 * Metadata alone is never sufficient authorization.
 */
export async function resolveWorkspaceFromConnectEvent(
  event: Stripe.Event,
): Promise<ConnectTenantContext | null> {
  const account =
    typeof event.account === "string"
      ? event.account
      : event.account && typeof event.account === "object" && "id" in event.account
        ? String((event.account as { id: string }).id)
        : null;
  if (!account || !account.startsWith("acct_")) return null;

  const prisma = getPrisma();
  const row = await prisma.merchantPaymentConnection.findFirst({
    where: { provider: "STRIPE", merchantAccountId: account, disconnectedAt: null },
    select: { workspaceId: true, merchantAccountId: true },
  });
  if (!row?.merchantAccountId) return null;
  return { workspaceId: row.workspaceId, connectedAccountId: row.merchantAccountId };
}

export async function validatePaymentRequestConnectTenant(input: {
  connectedAccountId: string | null | undefined;
  paymentRequestId: string;
  metadataWorkspaceId?: string | null;
}): Promise<
  | { ok: true; workspaceId: string; connectedAccountId: string }
  | { ok: false; reason: string }
> {
  if (!input.connectedAccountId?.startsWith("acct_")) {
    return { ok: false, reason: "missing_event_account" };
  }

  const prisma = getPrisma();
  const byAccount = await prisma.merchantPaymentConnection.findFirst({
    where: {
      provider: "STRIPE",
      merchantAccountId: input.connectedAccountId,
      disconnectedAt: null,
    },
    select: { workspaceId: true },
  });
  if (!byAccount) {
    return { ok: false, reason: "unknown_connected_account" };
  }

  const workspaceId = byAccount.workspaceId;
  if (input.metadataWorkspaceId && input.metadataWorkspaceId !== workspaceId) {
    return { ok: false, reason: "metadata_workspace_mismatch" };
  }

  const row = await prisma.paymentRequest.findFirst({
    where: { id: input.paymentRequestId, workspaceId },
  });
  if (!row) {
    return { ok: false, reason: "payment_request_not_in_workspace" };
  }
  if (
    row.processorConnectedAccountId &&
    row.processorConnectedAccountId !== input.connectedAccountId
  ) {
    return { ok: false, reason: "payment_request_account_mismatch" };
  }

  return { ok: true, workspaceId, connectedAccountId: input.connectedAccountId };
}

export async function assertConnectEventAuthorizedForPaymentRequest(input: {
  event: Stripe.Event;
  paymentRequestId: string;
  metadataWorkspaceId?: string | null;
}): Promise<{ authorized: true; workspaceId: string } | { authorized: false; reason: string }> {
  const tenant = await resolveWorkspaceFromConnectEvent(input.event);
  if (!tenant) {
    return { authorized: false, reason: "connect_tenant_unresolved" };
  }
  const check = await validatePaymentRequestConnectTenant({
    connectedAccountId: tenant.connectedAccountId,
    paymentRequestId: input.paymentRequestId,
    metadataWorkspaceId: input.metadataWorkspaceId ?? tenant.workspaceId,
  });
  if (!check.ok) {
    console.error("[stripe-connect] tenant validation failed", {
      reason: check.reason,
      eventId: input.event.id,
      paymentRequestId: input.paymentRequestId,
    });
    return { authorized: false, reason: check.reason };
  }
  return { authorized: true, workspaceId: check.workspaceId };
}
