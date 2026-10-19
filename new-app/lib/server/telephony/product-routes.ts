import "server-only";

import { getPrisma } from "@/lib/server/db";
import { getMctbTexmlAppId, getPhoneCallControlConnectionId } from "@/lib/server/telephony/config";
import { applyTelnyxConnectionWithVerify } from "@/lib/server/telephony/telnyx-route-safe";
import { readLiveTelnyxConnectionId } from "@/lib/server/telephony/telnyx-number";
import { writeTelephonyProvision } from "@/lib/server/telephony/telephony-record";

export async function routeNumberToMctbTexml(input: {
  workspaceId: string;
  phoneNumberId: string;
  priorConnectionId?: string | null;
}): Promise<{ ok: boolean; actions: string[]; error?: string }> {
  const texmlAppId = getMctbTexmlAppId();
  if (!texmlAppId) {
    return { ok: false, actions: [], error: "MCTB_TEXML_APP_ID is not configured on the server" };
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    return { ok: false, actions: [], error: "Phone number not found" };
  }

  const actions: string[] = [];
  try {
    const live = await readLiveTelnyxConnectionId({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
    });
    actions.push("read_live_telnyx_connection");

    await writeTelephonyProvision(phone.id, {
      routingMode: "mctb_texml",
      state: "provisioning",
      telnyxTexmlAppId: texmlAppId,
      lastError: null,
    });

    const routed = await applyTelnyxConnectionWithVerify({
      e164: phone.e164,
      providerNumberId: live.providerNumberId,
      targetConnectionId: texmlAppId,
      priorConnectionId: input.priorConnectionId ?? live.connectionId,
    });
    actions.push(...routed.actions);
    if (!routed.ok) {
      await writeTelephonyProvision(phone.id, {
        routingMode: "mctb_texml",
        state: "error",
        lastError: routed.error || "telnyx_route_failed",
      });
      return { ok: false, actions, error: routed.error };
    }

    await writeTelephonyProvision(phone.id, {
      routingMode: "mctb_texml",
      state: "active",
      telnyxTexmlAppId: texmlAppId,
      telnyxConnectionId: texmlAppId,
      lastVerifiedAt: new Date().toISOString(),
      lastError: null,
    });

    if (routed.providerNumberId !== phone.providerNumberId) {
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { providerNumberId: routed.providerNumberId },
      });
    }

    return { ok: true, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeTelephonyProvision(input.phoneNumberId, {
      routingMode: "mctb_texml",
      state: "error",
      lastError: message,
    });
    return { ok: false, actions, error: message };
  }
}

export async function routeNumberToPhoneCallControl(input: {
  workspaceId: string;
  phoneNumberId: string;
  priorConnectionId?: string | null;
}): Promise<{ ok: boolean; actions: string[]; error?: string }> {
  const connectionId = getPhoneCallControlConnectionId();
  if (!connectionId) {
    return {
      ok: false,
      actions: [],
      error: "TELNYX_CALL_CONTROL_APP_ID or TELNYX_CONNECTION_ID is not configured",
    };
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    return { ok: false, actions: [], error: "Phone number not found" };
  }

  const actions: string[] = [];
  try {
    const live = await readLiveTelnyxConnectionId({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
    });
    actions.push("read_live_telnyx_connection");

    await writeTelephonyProvision(phone.id, {
      routingMode: "telnyx_call_control",
      state: "provisioning",
      telnyxConnectionId: connectionId,
      lastError: null,
    });

    const routed = await applyTelnyxConnectionWithVerify({
      e164: phone.e164,
      providerNumberId: live.providerNumberId,
      targetConnectionId: connectionId,
      priorConnectionId: input.priorConnectionId ?? live.connectionId,
    });
    actions.push(...routed.actions);
    if (!routed.ok) {
      await writeTelephonyProvision(phone.id, {
        routingMode: "telnyx_call_control",
        state: "error",
        lastError: routed.error || "telnyx_route_failed",
      });
      return { ok: false, actions, error: routed.error };
    }

    await writeTelephonyProvision(phone.id, {
      routingMode: "telnyx_call_control",
      state: "active",
      telnyxConnectionId: connectionId,
      lastVerifiedAt: new Date().toISOString(),
      lastError: null,
    });

    if (routed.providerNumberId !== phone.providerNumberId) {
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { providerNumberId: routed.providerNumberId },
      });
    }

    return { ok: true, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeTelephonyProvision(input.phoneNumberId, {
      routingMode: "telnyx_call_control",
      state: "error",
      lastError: message,
    });
    return { ok: false, actions, error: message };
  }
}
