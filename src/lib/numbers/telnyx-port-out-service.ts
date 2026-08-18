/**
 * Telnyx port-out order sync, authorization, and webhook handling.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  mapTelnyxPortOutStatus,
  type PortOutRejectionCategory,
} from "./port-out-constants";
import { transitionPortOutStatus } from "./port-out-service";

type TelnyxPortOut = {
  id?: string;
  status?: string;
  phone_numbers?: string[];
  carrier_name?: string;
  authorized_name?: string;
  support_key?: string;
  foc_date?: string;
  ported_out_at?: string;
  rejection_reason?: string;
};

export async function listTelnyxPortOutOrders(input?: {
  phone?: string;
  status?: string;
}) {
  const query: Record<string, string> = {};
  if (input?.phone) query.phone_number = normalizeE164(input.phone);
  if (input?.status) query.status = input.status;

  const res = await telnyxRequest<{ data?: TelnyxPortOut[] }>("/portouts", {
    method: "GET",
    query,
  });
  return res?.data ?? [];
}

export async function getTelnyxPortOutOrder(portOutId: string) {
  const res = await telnyxRequest<{ data?: TelnyxPortOut }>(
    `/portouts/${encodeURIComponent(portOutId)}`,
    { method: "GET" },
  );
  return res?.data ?? null;
}

export async function authorizeTelnyxPortOut(portOutId: string, authorizedName?: string) {
  return telnyxRequest(`/portouts/${encodeURIComponent(portOutId)}/authorized`, {
    method: "PATCH",
    body: authorizedName ? { authorized_name: authorizedName } : {},
  });
}

export async function rejectTelnyxPortOut(portOutId: string, reason: string) {
  return telnyxRequest(`/portouts/${encodeURIComponent(portOutId)}/rejected-pending`, {
    method: "PATCH",
    body: { reason },
  });
}

function normalizePhoneFromTelnyx(phone: string) {
  return normalizeE164(phone);
}

export async function matchPortOutRequestForTelnyxOrder(input: {
  phone: string;
  telnyxPortOutId: string;
  carrierName?: string | null;
}) {
  const prisma = getPrisma();
  const e164 = normalizePhoneFromTelnyx(input.phone);
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164, provider: "telnyx" },
  });
  if (!pn) return { matched: false as const, reason: "number_not_found" };

  const activeIntent = await prisma.portOutRequest.findFirst({
    where: {
      workspaceId: pn.workspaceId,
      phoneNumberId: pn.id,
      status: { notIn: ["COMPLETED", "CANCELED"] },
    },
    orderBy: { initiatedAt: "desc" },
  });

  if (!activeIntent) {
    return {
      matched: false as const,
      unexpected: true as const,
      workspaceId: pn.workspaceId,
      phoneNumberId: pn.id,
      phone: e164,
      telnyxPortOutId: input.telnyxPortOutId,
    };
  }

  return {
    matched: true as const,
    workspaceId: pn.workspaceId,
    phoneNumberId: pn.id,
    portOutId: activeIntent.id,
    phone: e164,
    telnyxPortOutId: input.telnyxPortOutId,
    carrierName: input.carrierName,
  };
}

export async function handleTelnyxPortOutWebhook(payload: Record<string, unknown>) {
  const eventType = String(payload.event_type || "");
  const inner = (payload.payload as Record<string, unknown> | undefined) ?? payload;
  const telnyxId = String(inner.id || "");
  const status = String(inner.status || "");
  const phones = (inner.phone_numbers as string[] | undefined) ?? [];
  const phone = phones[0] || "";
  const carrierName = inner.carrier_name ? String(inner.carrier_name) : null;

  if (!telnyxId || !phone) {
    return { handled: false, reason: "missing_id_or_phone" };
  }

  const match = await matchPortOutRequestForTelnyxOrder({
    phone,
    telnyxPortOutId: telnyxId,
    carrierName,
  });

  if (!match.matched) {
    if ("unexpected" in match && match.unexpected && match.workspaceId) {
      const prisma = getPrisma();
      const workspace = await prisma.workspace.findUnique({
        where: { id: match.workspaceId },
        select: { ownerUserId: true },
      });
      const systemUserId = workspace?.ownerUserId || "system";
      await prisma.portOutRequest.create({
        data: {
          workspaceId: match.workspaceId,
          userId: systemUserId,
          phoneNumberId: match.phoneNumberId,
          phone: match.phone,
          provider: "telnyx",
          providerPortOutId: telnyxId,
          status: "UNEXPECTED_PORT_REQUEST",
          destinationCarrier: carrierName,
          statusHistoryJson: [
            {
              status: "UNEXPECTED_PORT_REQUEST",
              at: new Date().toISOString(),
              note: "Inbound port-out with no matching customer intent",
            },
          ],
          providerPayloadJson: inner,
        },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: match.workspaceId,
          event: "number.port_out_unexpected",
          detail: match.phone,
        },
      });
    }
    return { handled: true, unexpected: true };
  }

  const mapped = mapTelnyxPortOutStatus(status);
  let rejectionCategory: PortOutRejectionCategory | undefined;
  if (mapped === "ACTION_REQUIRED") {
    rejectionCategory = "OTHER_REJECTION";
    const reason = String(inner.rejection_reason || "").toLowerCase();
    if (reason.includes("pin")) rejectionCategory = "PIN_MISMATCH";
    else if (reason.includes("account")) rejectionCategory = "ACCOUNT_NUMBER_MISMATCH";
    else if (reason.includes("name")) rejectionCategory = "NAME_MISMATCH";
    else if (reason.includes("address")) rejectionCategory = "ADDRESS_MISMATCH";
  }

  const focDate = inner.foc_date ? new Date(String(inner.foc_date)) : null;
  const portedAt = inner.ported_out_at ? new Date(String(inner.ported_out_at)) : null;

  let finalStatus = mapped;
  if (portedAt || status === "ported") finalStatus = "COMPLETED";
  if (focDate && mapped === "AUTHORIZED") finalStatus = "SCHEDULED";

  const voicePortStatus =
    finalStatus === "COMPLETED" || status === "ported" ? "completed" : status || "pending";
  const messagingPortStatus =
    inner.messaging_status
      ? String(inner.messaging_status)
      : finalStatus === "COMPLETED"
        ? "completed"
        : "not_started";

  await transitionPortOutStatus({
    workspaceId: match.workspaceId,
    portOutId: match.portOutId,
    status: finalStatus,
    note: `Telnyx port-out ${eventType || status}`,
    providerPortOutId: telnyxId,
    rejectionCategory,
    rejectionDetailsInternal: String(inner.rejection_reason || ""),
    focDate,
    voicePortStatus,
    messagingPortStatus,
    providerPayload: inner,
  });

  const shouldAutoAuthorize =
    (finalStatus === "REQUEST_RECEIVED" || status === "pending") &&
    !rejectionCategory;

  if (shouldAutoAuthorize) {
    const intent = await getPrisma().portOutRequest.findUnique({ where: { id: match.portOutId } });
    if (intent && intent.status !== "UNEXPECTED_PORT_REQUEST") {
      try {
        await authorizeTelnyxPortOut(telnyxId, intent.authorizedContactName || undefined);
        await transitionPortOutStatus({
          workspaceId: match.workspaceId,
          portOutId: match.portOutId,
          status: "AUTHORIZED",
          note: "Auto-authorized matched customer port-out intent",
          providerPortOutId: telnyxId,
        });
      } catch (err) {
        console.warn("[telnyx-port-out] auto-authorize failed", err);
      }
    }
  }

  return { handled: true, portOutId: match.portOutId, status: finalStatus };
}

export async function syncTelnyxPortOutOrdersForNumber(workspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId, provider: "telnyx" },
  });
  if (!row) return { synced: 0 };

  const orders = await listTelnyxPortOutOrders({ phone: row.e164 }).catch(() => []);
  let synced = 0;
  for (const order of orders) {
    if (!order.id) continue;
    const result = await handleTelnyxPortOutWebhook({
      event_type: "portout.status_changed",
      payload: order,
    });
    if (result.handled) synced += 1;
  }
  return { synced };
}
