import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import type { DomainActionResult } from "./booking-actions";

export type ModelFieldRef = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  instruction: string;
};

export type ModelSlotRef = {
  slotId: string;
  start: string;
  spokenLabel: string;
};

function toModelField(entry: RuntimeFieldManifestEntry | null | undefined): ModelFieldRef | null {
  if (!entry) return null;
  return {
    id: entry.field_id,
    label: entry.label,
    type: entry.type,
    required: entry.required,
    instruction: entry.collection_instruction,
  };
}

function missingFields(session: AmyRealtimeSession): RuntimeFieldManifestEntry[] {
  return session.fieldManifest.filter(
    (field) => field.required && !session.collectedFields[field.field_id]?.trim(),
  );
}

function activeFieldEntry(session: AmyRealtimeSession): RuntimeFieldManifestEntry | null {
  if (session.activeField) {
    const active = session.fieldManifest.find((field) => field.field_id === session.activeField);
    if (active) return active;
  }
  return missingFields(session)[0] || null;
}

export function buildRequirementsPayload(session: AmyRealtimeSession): Record<string, unknown> {
  const missing = missingFields(session);
  const active = activeFieldEntry(session);
  const readyForAvailability = missing.length === 0;
  const status = readyForAvailability ? "ready_for_availability" : "collecting";

  return {
    status,
    activeField: toModelField(active),
    missingFields: missing.map((field) => field.field_id),
    collectedFields: session.collectedFields,
    readyForAvailability,
    nextAction: readyForAvailability ? "check_availability" : "collect_current_field",
  };
}

export function buildRecordFieldPayload(input: {
  session: AmyRealtimeSession;
  recordedFieldId: string;
}): Record<string, unknown> {
  const missing = missingFields(input.session);
  const nextField = activeFieldEntry(input.session);
  const recorded = input.session.fieldManifest.find((field) => field.field_id === input.recordedFieldId);
  const readyForAvailability = missing.length === 0;

  return {
    recordedField: toModelField(recorded || null),
    nextField: toModelField(nextField),
    missingFields: missing.map((field) => field.field_id),
    readyForAvailability,
    nextAction: readyForAvailability ? "check_availability" : "collect_current_field",
  };
}

function slotLabel(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildSlotsPayload(session: AmyRealtimeSession): ModelSlotRef[] {
  return (session.availableSlots || []).map((start) => ({
    slotId: start,
    start,
    spokenLabel: slotLabel(start, session.timezone || "America/New_York"),
  }));
}

export function buildHeldSlotPayload(session: AmyRealtimeSession): ModelSlotRef | null {
  const held = session.heldSlot || session.selectedSlot;
  if (!held) return null;
  return {
    slotId: held,
    start: held,
    spokenLabel: slotLabel(held, session.timezone || "America/New_York"),
  };
}

export function formatModelToolResult(
  result: DomainActionResult,
  options?: {
    session?: AmyRealtimeSession;
    toolName?: string;
    extra?: Record<string, unknown>;
  },
): Record<string, unknown> {
  const workflowState = (result.workflow_state || options?.session?.currentState) as
    | WorkflowState
    | undefined;

  const payload: Record<string, unknown> = {
    success: result.ok,
    workflowState,
    userSafeMessage: result.speak,
    errorCode: result.error_code,
    ...(result.data || {}),
    ...(options?.extra || {}),
  };

  if (options?.session) {
    if (options.toolName === "get_booking_requirements" || options.toolName === "record_current_field") {
      Object.assign(payload, buildRequirementsPayload(options.session));
    }
    if (options.toolName === "check_availability") {
      payload.slots = buildSlotsPayload(options.session);
      payload.timezone = options.session.timezone;
      if (!result.ok) {
        payload.nextAction = "ask_for_another_date_or_range";
      } else if ((options.session.availableSlots || []).length === 0) {
        payload.nextAction = "ask_for_another_date_or_range";
      } else {
        payload.nextAction = "select_slot";
      }
    }
    if (options.toolName === "select_slot") {
      payload.heldSlot = buildHeldSlotPayload(options.session);
      if (result.ok) payload.nextAction = "confirm_booking";
    }
    if (options.toolName === "confirm_booking" && result.ok) {
      payload.workflowState = "COMPLETE";
      if (options.session.bookingId) {
        payload.booking = {
          bookingId: options.session.bookingId,
          start: options.session.heldSlot || options.session.selectedSlot,
          spokenLabel: buildHeldSlotPayload(options.session)?.spokenLabel,
        };
      }
    }
  }

  if (result.data?.nextAction) {
    payload.nextAction = result.data.nextAction;
  }

  return payload;
}
