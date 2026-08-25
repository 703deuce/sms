import "server-only";

import { getPrisma } from "@/lib/db";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import {
  answerCall,
  gatherUsingSpeakRaw,
  hangupCall,
  speakOnCallRaw,
} from "@/lib/smart-routing/telnyx-provider";
import { encodeCallForwardingOutboundState } from "./access-state";
import {
  bridgeCallForwardingLegs,
  originateCallForwardingCustomerLeg,
} from "./outbound-bridge";

export async function playCallForwardingConfirmGather(input: {
  callControlId: string;
  outboundCallId: string;
  workspaceId: string;
  destinationE164: string;
}) {
  const display = fmtPhoneDisplay(input.destinationE164);
  const text = `Calling ${display}. Press 1 to connect. Hang up to cancel.`;
  const clientState = encodeCallForwardingOutboundState({
    kind: "call_forwarding_outbound",
    outboundCallId: input.outboundCallId,
    workspaceId: input.workspaceId,
    awaiting: "confirm",
  });
  await gatherUsingSpeakRaw({
    callControlId: input.callControlId,
    text,
    validDigits: "1",
    maxDigits: 1,
    clientStateBase64: clientState,
  });
}

export async function handleCallForwardingOutboundAnswered(input: {
  callControlId: string;
  outboundCallId: string;
  workspaceId: string;
}) {
  const outbound = await getPrisma().callForwardingOutboundCall.findUnique({
    where: { id: input.outboundCallId },
  });
  if (!outbound) return { handled: false as const };

  if (outbound.employeeCallControlId === input.callControlId) {
    await answerCall(input.callControlId);
    await playCallForwardingConfirmGather({
      callControlId: input.callControlId,
      outboundCallId: input.outboundCallId,
      workspaceId: input.workspaceId,
      destinationE164: outbound.destinationE164,
    });
    return { handled: true as const, kind: "employee_confirm" };
  }

  if (outbound.customerCallControlId === input.callControlId && outbound.employeeCallControlId) {
    await bridgeCallForwardingLegs({
      employeeCallControlId: outbound.employeeCallControlId,
      customerCallControlId: input.callControlId,
      outboundCallId: input.outboundCallId,
    });
    return { handled: true as const, kind: "customer_bridged" };
  }

  return { handled: false as const };
}

export async function handleCallForwardingOutboundGather(input: {
  callControlId: string;
  digits: string;
  outboundCallId: string;
  workspaceId: string;
}) {
  const digit = input.digits.trim();
  const outbound = await getPrisma().callForwardingOutboundCall.findUnique({
    where: { id: input.outboundCallId },
  });
  if (!outbound) return { handled: false as const };

  if (digit !== "1") {
    await speakOnCallRaw(input.callControlId, "Call cancelled. Goodbye.");
    await hangupCall(input.callControlId);
    return { handled: true as const, cancelled: true as const };
  }

  const customer = await originateCallForwardingCustomerLeg({
    workspaceId: input.workspaceId,
    outboundCallId: input.outboundCallId,
    employeeCallControlId: input.callControlId,
    destinationE164: outbound.destinationE164,
  });

  if (customer.mock) {
    return { handled: true as const, mock: true as const };
  }

  return { handled: true as const, customerCallControlId: customer.customerCallControlId };
}
