import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  answerCall,
  gatherUsingSpeakRaw,
  speakOnCallRaw,
  hangupCall,
} from "./telnyx-provider";
import {
  createOutboundCallRecord,
  originateCustomerLeg,
} from "./outbound-bridge";
import { encodeEmployeeAccessState } from "./employee-access-state";
import type { OutboundContextType } from "./outbound-bridge";
import { verifyAuthorizedCallerPin } from "./authorized-callers";
import { loadSmartRoutingWorkspaceSettings } from "./workspace-settings";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

async function speakAndGather(
  callControlId: string,
  text: string,
  clientStateBase64: string,
  opts?: { validDigits?: string; maxDigits?: number; finishOnKey?: string },
) {
  await gatherUsingSpeakRaw({
    callControlId,
    text,
    validDigits: opts?.validDigits ?? "0123456789*#",
    maxDigits: opts?.maxDigits,
    finishOnKey: opts?.finishOnKey,
    clientStateBase64,
  });
}

export async function rejectUnauthorizedCallbackCaller(callControlId: string) {
  await answerCall(callControlId);
  await speakOnCallRaw(
    callControlId,
    "This number is for authorized team members only. Goodbye.",
  );
  await hangupCall(callControlId);
}

export async function tryStartEmployeeAccess(input: {
  workspaceId: string;
  callerE164: string;
  calledE164: string;
  callControlId: string;
  authorizedCallerId: string;
  authorizedCallerName: string;
}) {
  const entitled = await hasWorkspaceProductFeature(input.workspaceId, "smart_routing");
  if (!entitled) return { started: false as const, reason: "not_entitled" };

  const settings = await loadSmartRoutingWorkspaceSettings(input.workspaceId);
  if (!settings?.outboundEnabled) return { started: false as const, reason: "outbound_disabled" };

  const prisma = getPrisma();
  const existing = await prisma.smartRoutingAccessSession.findFirst({
    where: { callControlId: input.callControlId },
  });
  if (existing) return { started: true as const, accessSessionId: existing.id };

  await answerCall(input.callControlId);

  const session = await prisma.smartRoutingAccessSession.create({
    data: {
      workspaceId: input.workspaceId,
      callControlId: input.callControlId,
      callerNumber: normalizeE164(input.callerE164),
      calledNumber: normalizeE164(input.calledE164),
      authorizedCallerId: input.authorizedCallerId,
      state: "pin_entry",
    },
  });

  const clientState = encodeEmployeeAccessState({
    kind: "smart_routing_employee",
    accessSessionId: session.id,
    workspaceId: input.workspaceId,
    awaiting: "pin",
  });

  const greeting = `Welcome to Smart Routing. Hi ${input.authorizedCallerName.split(" ")[0]}. Please enter your PIN.`;
  await speakAndGather(input.callControlId, greeting, clientState, {
    validDigits: "0123456789",
    maxDigits: 6,
    finishOnKey: "#",
  });

  return { started: true as const, accessSessionId: session.id, employeeAccess: true as const };
}

async function playOutboundMenu(
  callControlId: string,
  accessSessionId: string,
  workspaceId: string,
) {
  const text =
    "Press 1 for your latest missed call. Press 2 for your latest voicemail. Press 3 for your latest callback request. Press 4 to enter another number. Press 9 to repeat.";
  const clientState = encodeEmployeeAccessState({
    kind: "smart_routing_employee",
    accessSessionId,
    workspaceId,
    awaiting: "menu",
  });
  await speakAndGather(callControlId, text, clientState, { validDigits: "12349" });
}

export async function handleEmployeeAccessGather(input: {
  callControlId: string;
  digits: string;
  accessSessionId: string;
  workspaceId: string;
}) {
  const prisma = getPrisma();
  const access = await prisma.smartRoutingAccessSession.findFirst({
    where: { id: input.accessSessionId, workspaceId: input.workspaceId },
  });
  if (!access) return { handled: true, done: true };

  const digits = input.digits.replace(/\D/g, "");

  if (access.state === "pin_entry") {
    if (!access.authorizedCallerId) {
      await hangupCall(input.callControlId);
      return { handled: true, done: true };
    }
    const verified = await verifyAuthorizedCallerPin({
      workspaceId: input.workspaceId,
      callerId: access.authorizedCallerId,
      pin: digits,
    });
    if (!verified.ok) {
      const attempts = access.pinAttempts + 1;
      await prisma.smartRoutingAccessSession.update({
        where: { id: access.id },
        data: { pinAttempts: attempts },
      });
      if (attempts >= 5 || verified.reason === "locked") {
        await speakOnCallRaw(input.callControlId, "Too many incorrect attempts. Goodbye.");
        await hangupCall(input.callControlId);
        return { handled: true, done: true };
      }
      const clientState = encodeEmployeeAccessState({
        kind: "smart_routing_employee",
        accessSessionId: access.id,
        workspaceId: input.workspaceId,
        awaiting: "pin",
      });
      await speakAndGather(
        input.callControlId,
        "Incorrect PIN. Please try again.",
        clientState,
        { validDigits: "0123456789", maxDigits: 6, finishOnKey: "#" },
      );
      return { handled: true, done: false };
    }
    await prisma.smartRoutingAccessSession.update({
      where: { id: access.id },
      data: { state: "menu", pinAttempts: 0 },
    });
    await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
    return { handled: true, done: false };
  }

  if (access.state === "menu") {
    const digit = digits.charAt(0);
    if (digit === "9") {
      await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
      return { handled: true, done: false };
    }

    let destination: string | null = null;
    let contextType: OutboundContextType = "manual";
    let contextRefId: string | null = null;

    if (digit === "1") {
      const missed = await prisma.missedCallEvent.findFirst({
        where: { workspaceId: input.workspaceId },
        orderBy: { detectedAt: "desc" },
      });
      if (!missed?.callerE164) {
        await speakOnCallRaw(input.callControlId, "There are no recent missed calls.");
        await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
        return { handled: true, done: false };
      }
      destination = missed.callerE164;
      contextType = "missed_call";
      contextRefId = missed.id;
    } else if (digit === "2") {
      const vm = await prisma.voicemailMessage.findFirst({
        where: { workspaceId: input.workspaceId, fromE164: { not: null } },
        orderBy: { createdAt: "desc" },
      });
      if (!vm?.fromE164) {
        await speakOnCallRaw(input.callControlId, "There are no recent voicemail callers.");
        await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
        return { handled: true, done: false };
      }
      destination = vm.fromE164;
      contextType = "voicemail";
      contextRefId = vm.id;
    } else if (digit === "3") {
      const cb = await prisma.callbackRequest.findFirst({
        where: { workspaceId: input.workspaceId, status: { in: ["new", "contacted"] } },
        orderBy: { requestedAt: "desc" },
      });
      if (!cb?.callerE164) {
        await speakOnCallRaw(input.callControlId, "There are no callback requests waiting.");
        await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
        return { handled: true, done: false };
      }
      destination = cb.callerE164;
      contextType = "callback_request";
      contextRefId = cb.id;
      await prisma.callbackRequest.update({
        where: { id: cb.id },
        data: { status: "contacted", contactedAt: new Date() },
      });
    } else if (digit === "4") {
      await prisma.smartRoutingAccessSession.update({
        where: { id: access.id },
        data: { state: "manual_entry" },
      });
      const clientState = encodeEmployeeAccessState({
        kind: "smart_routing_employee",
        accessSessionId: access.id,
        workspaceId: input.workspaceId,
        awaiting: "manual_entry",
      });
      await speakAndGather(
        input.callControlId,
        "Enter the 10 digit phone number followed by pound.",
        clientState,
        { validDigits: "0123456789", finishOnKey: "#" },
      );
      return { handled: true, done: false };
    } else {
      await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
      return { handled: true, done: false };
    }

    if (!destination) return { handled: true, done: false };

    await prisma.smartRoutingAccessSession.update({
      where: { id: access.id },
      data: {
        pendingDestination: destination,
        contextType,
        contextRefId,
        state: "confirm",
      },
    });

    const last10 = destination.replace(/\D/g, "").slice(-10);
    const clientState = encodeEmployeeAccessState({
      kind: "smart_routing_employee",
      accessSessionId: access.id,
      workspaceId: input.workspaceId,
      awaiting: "confirm",
    });
    await speakAndGather(
      input.callControlId,
      `Calling ${last10}. Press 1 to continue or 2 to go back.`,
      clientState,
      { validDigits: "12" },
    );
    return { handled: true, done: false };
  }

  if (access.state === "manual_entry") {
    const num = digits.slice(0, 10);
    if (num.length < 10) {
      await speakOnCallRaw(input.callControlId, "Invalid number.");
      await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
      return { handled: true, done: false };
    }
    const destination = normalizeE164(num.length === 10 ? `+1${num}` : num);
    await prisma.smartRoutingAccessSession.update({
      where: { id: access.id },
      data: {
        pendingDestination: destination,
        contextType: "manual",
        contextRefId: null,
        state: "confirm",
      },
    });
    const clientState = encodeEmployeeAccessState({
      kind: "smart_routing_employee",
      accessSessionId: access.id,
      workspaceId: input.workspaceId,
      awaiting: "confirm",
    });
    await speakAndGather(
      input.callControlId,
      `Calling ${num}. Press 1 to continue or 2 to go back.`,
      clientState,
      { validDigits: "12" },
    );
    return { handled: true, done: false };
  }

  if (access.state === "confirm") {
    const choice = digits.charAt(0);
    if (choice === "2") {
      await prisma.smartRoutingAccessSession.update({
        where: { id: access.id },
        data: { state: "menu", pendingDestination: null },
      });
      await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
      return { handled: true, done: false };
    }
    if (choice !== "1" || !access.pendingDestination) {
      await playOutboundMenu(input.callControlId, access.id, input.workspaceId);
      return { handled: true, done: false };
    }

    try {
      const outbound = await createOutboundCallRecord({
        workspaceId: input.workspaceId,
        authorizedCallerId: access.authorizedCallerId,
        employeePhoneE164: access.callerNumber,
        destinationE164: access.pendingDestination,
        contextType: (access.contextType as OutboundContextType) || "manual",
        contextRefId: access.contextRefId,
        employeeCallControlId: input.callControlId,
      });
      await speakOnCallRaw(input.callControlId, "Please hold while we connect your call.");
      await originateCustomerLeg({
        workspaceId: input.workspaceId,
        accessSessionId: access.id,
        outboundCallId: outbound.id,
        employeeCallControlId: input.callControlId,
        destinationE164: access.pendingDestination,
        fromRoutingE164: access.calledNumber,
      });
      return { handled: true, done: false };
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes("verified")
          ? "Outbound business calling is not available until your business number is verified."
          : "We could not place that call. Please try again later.";
      await speakOnCallRaw(input.callControlId, msg);
      await hangupCall(input.callControlId);
      return { handled: true, done: true };
    }
  }

  return { handled: false, done: false };
}

export async function handleEmployeeAccessCustomerAnswered(input: {
  employeeCallControlId: string;
  customerCallControlId: string;
  accessSessionId: string;
  outboundCallId?: string;
}) {
  const prisma = getPrisma();
  const access = await prisma.smartRoutingAccessSession.findUnique({
    where: { id: input.accessSessionId },
  });
  if (!access) return;

  const outbound = input.outboundCallId
    ? await prisma.smartRoutingOutboundCall.findUnique({ where: { id: input.outboundCallId } })
    : await prisma.smartRoutingOutboundCall.findFirst({
        where: {
          workspaceId: access.workspaceId,
          employeeCallControlId: input.employeeCallControlId,
          result: { in: ["initiated", "bridged"] },
        },
        orderBy: { createdAt: "desc" },
      });

  if (!outbound) return;

  const { bridgeEmployeeToCustomer } = await import("./outbound-bridge");
  await bridgeEmployeeToCustomer({
    employeeCallControlId: input.employeeCallControlId,
    customerCallControlId: input.customerCallControlId,
    outboundCallId: outbound.id,
  });
  await prisma.smartRoutingAccessSession.update({
    where: { id: input.accessSessionId },
    data: { state: "bridged" },
  });
}
