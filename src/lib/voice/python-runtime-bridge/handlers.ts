import { getPrisma } from "@/lib/db";
import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import { validateReceptionistFieldValue } from "@/lib/voice/receptionist/field-validation";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { extractDeterministicFieldsFromUtterance } from "../../../../voice-runtime/src/frontdesk/receptionist/collection-field-extractor";
import { CalendlyCalendar } from "../../../../voice-runtime/src/frontdesk/calendly-calendar";
import { writeBookingToProvider } from "../../../../voice-runtime/src/frontdesk/booking-provider-write";
import { markBookingConfirmed, type FrontDeskUserData } from "../../../../voice-runtime/src/frontdesk/userdata";
import { buildBookingSuccessLine } from "../../../../voice-runtime/src/booking-completion-messages";
import { markVoiceCallBooked } from "@/lib/voice/runtime-provider/livekit-call-telemetry";
import { sendBookingSmsAsync } from "../../../../voice-runtime/src/frontdesk/booking-sms";
import type {
  AvailabilitySlot,
  ExtractFieldsInput,
  PythonRuntimeError,
} from "./types";

export { persistIntakeFieldsForPython } from "./persist-intake-fields";
export { persistMessageForPython } from "./persist-message";
export { resolveTransferForPython } from "./resolve-transfer";

export async function extractFieldsForPython(
  input: ExtractFieldsInput,
): Promise<{ ok: true; fields: Record<string, string>; correction: boolean } | PythonRuntimeError> {
  const result = extractDeterministicFieldsFromUtterance(
    input.transcript,
    input.manifest,
    input.currentFields,
    input.callerE164,
  );
  const validated: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(result.fields)) {
    const field = input.manifest.find((f) => f.id === fieldId);
    if (!field) continue;
    try {
      validated[fieldId] = validateReceptionistFieldValue(field, value);
    } catch {
      continue;
    }
  }
  return { ok: true, fields: validated, correction: result.correction };
}

export async function getAvailabilityForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  timezone: string;
  eventTypeUri?: string | null;
  daysAhead?: number;
}): Promise<{ ok: true; slots: AvailabilitySlot[]; linesForModel: string } | PythonRuntimeError> {
  const cal = CalendlyCalendar.create({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    timezone: input.timezone,
    eventTypeUri: input.eventTypeUri,
  });

  try {
    const slots = await cal.listAvailableSlots({ daysAhead: input.daysAhead ?? 14 });
    const lines = cal.formatSlotsForModel(slots);
    const formatted: AvailabilitySlot[] = slots.map((slot) => ({
      slotId: slot.slotId,
      startTimeIso: slot.startTime.toISOString(),
      durationMin: slot.durationMin,
      spokenLabel: cal.formatSlotsForModel([slot]).split("\n")[0] || slot.slotId,
    }));
    return { ok: true, slots: formatted, linesForModel: lines };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "AVAILABILITY_FAILED",
    };
  }
}

function buildMinimalUserData(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  timezone: string;
  businessName: string;
  callerE164?: string;
  fields: Record<string, string>;
  eventTypeUri?: string | null;
}): FrontDeskUserData {
  const cal = CalendlyCalendar.create({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    timezone: input.timezone,
    eventTypeUri: input.eventTypeUri,
  });

  return {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    businessName: input.businessName,
    timezone: input.timezone,
    cal,
    slotUnavailableCount: 0,
    callerE164: input.callerE164,
    receptionistFields: { ...input.fields },
  };
}

export async function commitBookingForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  slotId: string;
  timezone: string;
  businessName: string;
  callerE164?: string;
  fields: Record<string, string>;
  attendeeEmail?: string;
  eventTypeUri?: string | null;
  offeredSlotIds?: string[];
}): Promise<
  | {
      ok: true;
      bookedTimeLabel: string;
      confirmationSpeech: string;
      providerEventId?: string;
      alreadyBooked?: boolean;
      receiptPersisted?: boolean;
    }
  | PythonRuntimeError
> {
  if (
    input.offeredSlotIds?.length &&
    !input.offeredSlotIds.includes(input.slotId)
  ) {
    return { ok: false, error: "Slot was not in the offered set", code: "INVALID_SLOT" };
  }

  const prisma = getPrisma();
  const callRow = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const priorMeta =
    callRow?.metadata && typeof callRow.metadata === "object" && !Array.isArray(callRow.metadata)
      ? (callRow.metadata as Record<string, unknown>)
      : {};
  const existingReceipt = priorMeta.pythonBookingReceipt as
    | { bookedTimeLabel?: string; slotId?: string }
    | undefined;
  if (existingReceipt?.slotId) {
    const label = existingReceipt.bookedTimeLabel || "your appointment";
    return {
      ok: true,
      bookedTimeLabel: label,
      confirmationSpeech: buildBookingSuccessLine(label),
      alreadyBooked: true,
      receiptPersisted: true,
    };
  }

  const existingAppt = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      status: { notIn: ["cancelled", "canceled"] },
    },
    select: { startsAt: true },
  });
  if (existingAppt?.startsAt) {
    const label = existingAppt.startsAt.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: input.timezone,
    });
    return {
      ok: true,
      bookedTimeLabel: label,
      confirmationSpeech: buildBookingSuccessLine(label),
      alreadyBooked: true,
      receiptPersisted: true,
    };
  }

  const userData = buildMinimalUserData(input);
  const slotsMap = new Map<string, import("../../../../voice-runtime/src/frontdesk/calendly-calendar").AvailableSlot>();

  const availability = await getAvailabilityForPython({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    timezone: input.timezone,
    eventTypeUri: input.eventTypeUri,
  });
  if (!availability.ok) return availability;

  for (const slot of availability.slots) {
    slotsMap.set(slot.slotId, {
      slotId: slot.slotId,
      startTime: new Date(slot.startTimeIso),
      durationMin: slot.durationMin,
    });
  }

  const slot = slotsMap.get(input.slotId);
  if (!slot) {
    return { ok: false, error: "Slot not found", code: "INVALID_SLOT" };
  }

  const emailField = Object.entries(input.fields).find(([id]) => id === "email" || id.endsWith("_email"));
  const attendeeEmail = input.attendeeEmail?.trim() || emailField?.[1]?.trim();
  if (!attendeeEmail) {
    return { ok: false, error: "Email required for booking", code: "MISSING_EMAIL" };
  }

  try {
    const { booked, bookedTimeLabel } = await writeBookingToProvider({
      userData,
      slot,
      slotId: input.slotId,
      attendeeEmail,
    });

    markBookingConfirmed(userData, {
      slotId: input.slotId,
      bookedTimeLabel,
      providerEventId: booked.eventUri,
      appointmentId: booked.inviteeUri,
    });

    void markVoiceCallBooked({
      workspaceId: input.workspaceId,
      callId: input.callId,
      appointmentId: booked.inviteeUri,
      externalId: booked.eventUri,
    });

    sendBookingSmsAsync(userData, slot.startTime);

    const confirmationSpeech = buildBookingSuccessLine(bookedTimeLabel);

    const prisma = getPrisma();
    const existing = await prisma.voiceCall.findFirst({
      where: { id: input.callId },
      select: { metadata: true },
    });
    const priorMeta =
      existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    await prisma.voiceCall.update({
      where: { id: input.callId },
      data: {
        status: "COMPLETED",
        metadata: {
          ...priorMeta,
          pythonBookingReceipt: {
            slotId: input.slotId,
            bookedTimeLabel,
            providerEventId: booked.eventUri,
            appointmentId: booked.inviteeUri,
            committedAt: new Date().toISOString(),
          },
        } as object,
      },
    });

    console.log(
      JSON.stringify({
        source: "voice-python",
        event: "receipt_persisted",
        callId: input.callId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        slotId: input.slotId,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      ok: true,
      bookedTimeLabel,
      confirmationSpeech,
      providerEventId: booked.eventUri,
      receiptPersisted: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "BOOKING_WRITE_FAILED",
    };
  }
}

export async function businessAnswerForPython(input: {
  workspaceId: string;
  agentId: string;
  topic: string;
}): Promise<{ ok: true; speak: string } | PythonRuntimeError> {
  const result = await resolveBusinessAnswer({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    topic: input.topic,
  });
  if (!result.ok) {
    return { ok: false, error: result.speak || "Knowledge lookup failed", code: "KNOWLEDGE_FAILED" };
  }
  return { ok: true, speak: result.speak };
}

export async function emitVoiceRuntimeEvent(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  event: string;
  workflow?: string;
  extra?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  console.log(
    JSON.stringify({
      source: "python-voice-runtime-bridge",
      event: input.event,
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow: input.workflow,
      timestamp: new Date().toISOString(),
      ...input.extra,
    }),
  );
  return { ok: true };
}
