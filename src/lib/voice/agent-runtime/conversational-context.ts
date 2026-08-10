import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { buildHeldSlotPayload, buildRequirementsPayload, buildSlotsPayload } from "@/lib/voice/domain-actions/tool-results";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { activeTaskForContext, type AmyActiveTask } from "./task-types";

const TASK_FOCUS: Record<AmyActiveTask, string> = {
  reception: "Find out why they called and collect the next detail you still need.",
  book_appointment: "Help them choose a time and confirm the booking.",
  modify_appointment: "Help them find, reschedule, or cancel an existing appointment.",
  take_message: "Capture their message for the business.",
  transfer: "Connect them with a person, or take a message if needed.",
  complete: "Wrap up warmly and end the call when they're done.",
};

/**
 * Minimal dynamic session context for the LLM — one task focus, next ask, and live options.
 * Avoids duplicating the permanent prompt or workflow node instruction stacks.
 */
export function buildConversationalContextBlock(ctx: LiveKitCallContext): string {
  const { canonical } = compileToolsForCallContext(ctx);
  const callerIntent = ctx.session.runtime.session_runtime?.callerIntent || null;
  const activeTask = activeTaskForContext({
    callerIntent,
    currentNodeId: canonical?.currentNodeId,
    bookingReceiptPresent: canonical?.bookingReceiptPresent,
  });

  const requirements = buildRequirementsPayload(ctx.session);
  const slots = buildSlotsPayload(ctx.session);
  const held = buildHeldSlotPayload(ctx.session);

  const lines: string[] = [
    `SESSION: ${activeTask}`,
    TASK_FOCUS[activeTask],
  ];

  if (callerIntent) {
    lines.push(`Intent: ${callerIntent}`);
  }

  const collectedLabels = Object.entries(ctx.session.collectedFields)
    .filter(([, value]) => value?.trim())
    .map(([fieldId]) => {
      return ctx.session.fieldManifest.find((field) => field.field_id === fieldId)?.label || fieldId;
    });
  if (collectedLabels.length > 0) {
    lines.push(`Collected: ${collectedLabels.join(", ")}`);
  }

  const activeField = requirements.activeField as { label?: string; instruction?: string } | null;
  if (activeField?.label) {
    lines.push(
      activeField.instruction
        ? `Ask next: ${activeField.label} — ${activeField.instruction}`
        : `Ask next: ${activeField.label}`,
    );
  }

  if (slots.length > 0 && !held) {
    lines.push("Times to offer (pick two or three verbally; use slot id when they choose):");
    for (const slot of slots.slice(0, 3)) {
      lines.push(`- ${slot.spokenLabel} (id: ${slot.slotId})`);
    }
  }

  if (held) {
    lines.push(`Held for confirmation: ${held.spokenLabel} (id: ${held.slotId})`);
  }

  if (canonical?.bookingReceiptPresent && ctx.session.bookingId) {
    lines.push(`Booked: ${ctx.session.bookingId}`);
  }

  const appointmentId = ctx.session.runtime.session_runtime?.foundAppointmentId;
  if (appointmentId && activeTask === "modify_appointment") {
    lines.push(`Appointment on file: ${appointmentId}`);
  }

  return lines.join("\n");
}
