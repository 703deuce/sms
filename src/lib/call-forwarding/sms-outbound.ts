import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { isBlockedCallbackDestination } from "@/lib/smart-routing/callback-destination-policy";
import { findCallForwardingAuthorizedCaller } from "./authorized-callers";
import { extractCallDestinationFromSms, verifySmsCallExtraction } from "./sms-extract";
import {
  createCallForwardingOutboundRecord,
  originateCallForwardingEmployeeLeg,
} from "./outbound-bridge";
import { loadCallForwardingWorkspaceSettings } from "./workspace-settings";

const PHONE_ONLY_RE = /^[\s\d().+-]+$/;

/** SMS command: text customer number to control number → voice callback with Press 1. */
export async function tryHandleCallForwardingSms(input: {
  workspaceId: string;
  toE164: string;
  fromE164: string;
  body: string;
}): Promise<{ handled: true; silent: true } | { handled: false }> {
  if (!(await hasWorkspaceProductFeature(input.workspaceId, "call_forwarding"))) {
    return { handled: false };
  }

  const ws = await loadCallForwardingWorkspaceSettings(input.workspaceId);
  if (!ws?.smsOutboundEnabled) return { handled: false };

  const to = normalizeE164(input.toE164);
  const controlMatch =
    (ws.controlNumberE164 && normalizeE164(ws.controlNumberE164) === to) ||
    (ws.controlPhoneNumberId &&
      (await getPrisma().phoneNumber.findFirst({
        where: { id: ws.controlPhoneNumberId, e164: to },
        select: { id: true },
      })));

  if (!controlMatch) return { handled: false };

  const caller = await findCallForwardingAuthorizedCaller({
    workspaceId: input.workspaceId,
    callerE164: input.fromE164,
  });
  if (!caller) {
    return { handled: true, silent: true };
  }

  const body = input.body.trim();
  if (!body) return { handled: true, silent: true };

  let destination: string | null = null;

  if (PHONE_ONLY_RE.test(body)) {
    try {
      const digits = body.replace(/\D/g, "");
      if (digits.length >= 10) {
        destination = normalizeE164(digits.length === 10 ? `+1${digits}` : `+${digits}`);
      }
    } catch {
      destination = null;
    }
  }

  if (!destination) {
    const extract = await extractCallDestinationFromSms(body);
    if (!extract || extract.intent !== "place_call" || extract.ambiguous || !extract.destination) {
      return { handled: true, silent: true };
    }
    const verify = await verifySmsCallExtraction(body, extract);
    if (!verify.approved || !verify.destination) {
      return { handled: true, silent: true };
    }
    destination = verify.destination;
  }

  if (
    isBlockedCallbackDestination(destination, {
      routingNumberE164: ws.businessNumberE164,
      callbackNumberE164: ws.controlNumberE164,
    })
  ) {
    return { handled: true, silent: true };
  }

  const fromControl = ws.controlNumberE164 || to;
  const outbound = await createCallForwardingOutboundRecord({
    workspaceId: input.workspaceId,
    authorizedCallerId: caller.id,
    employeePhoneE164: caller.phoneE164,
    destinationE164: destination,
    smsBody: body,
  });

  await originateCallForwardingEmployeeLeg({
    workspaceId: input.workspaceId,
    outboundCallId: outbound.id,
    employeePhoneE164: caller.phoneE164,
    fromE164: fromControl,
  }).catch((err) => {
    console.error("[call-forwarding] originate employee leg failed", err);
  });

  return { handled: true, silent: true };
}
