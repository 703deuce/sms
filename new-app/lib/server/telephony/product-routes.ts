import "server-only";

import { getPrisma } from "@/lib/server/db";
import { getMctbTexmlAppId, getPhoneCallControlConnectionId } from "@/lib/server/telephony/config";
import {
  routeTelnyxNumberToConnection,
  resolveTelnyxPhoneNumberId,
} from "@/lib/server/telephony/telnyx-livekit-fqdn";
import { writeTelephonyProvision } from "@/lib/server/telephony/telephony-record";
import { telnyxRequest } from "@/lib/server/telnyx/client";

export async function routeNumberToMctbTexml(input: {
  workspaceId: string;
  phoneNumberId: string;
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
    const providerNumberId = await resolveTelnyxPhoneNumberId({
      e164: phone.e164,
      existingId: phone.providerNumberId,
    });
    await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
      method: "PATCH",
      body: { connection_id: texmlAppId },
    });
    actions.push("telnyx_routed_to_mctb_texml");

    await writeTelephonyProvision(phone.id, {
      routingMode: "mctb_texml",
      state: "active",
      telnyxTexmlAppId: texmlAppId,
      telnyxConnectionId: texmlAppId,
      lastError: null,
    });

    if (providerNumberId !== phone.providerNumberId) {
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { providerNumberId },
      });
    }

    return { ok: true, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeTelephonyProvision(phone.id, {
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
    const route = await routeTelnyxNumberToConnection({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
      connectionId,
    });
    if (route.previousConnectionId && route.previousConnectionId !== connectionId) {
      actions.push(`telnyx_rerouted:${route.previousConnectionId}->${connectionId}`);
    } else {
      actions.push("telnyx_route_ok");
    }

    await writeTelephonyProvision(phone.id, {
      routingMode: "telnyx_call_control",
      state: "active",
      telnyxConnectionId: connectionId,
      lastError: null,
    });

    if (route.providerNumberId !== phone.providerNumberId) {
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { providerNumberId: route.providerNumberId },
      });
    }

    return { ok: true, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeTelephonyProvision(phone.id, {
      routingMode: "telnyx_call_control",
      state: "error",
      lastError: message,
    });
    return { ok: false, actions, error: message };
  }
}
