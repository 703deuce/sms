import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { buildHeldSlotPayload, buildRequirementsPayload, buildSlotsPayload } from "@/lib/voice/domain-actions/tool-results";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { activeTaskForContext } from "./task-types";

/**
 * Human-facing session context for the LLM — no internal node IDs or expected_next_action dumps.
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

  const lines: string[] = [`ACTIVE CAPABILITY: ${activeTask}`];

  if (callerIntent) {
    lines.push(`Caller intent: ${callerIntent}`);
  }

  const missing = canonical?.missingFieldIds || [];
  if (missing.length > 0) {
    lines.push(`Still need from caller: ${missing.join(", ")}`);
    const activeField = requirements.activeField as { label?: string; instruction?: string } | null;
    if (activeField?.instruction) {
      lines.push(`Guidance: ${activeField.instruction}`);
    } else if (activeField?.label) {
      lines.push(`Ask for: ${activeField.label}`);
    }
  }

  if (slots.length > 0 && !held) {
    lines.push("Available appointment times (offer these only):");
    for (const slot of slots.slice(0, 5)) {
      lines.push(`- ${slot.spokenLabel} (id: ${slot.slotId})`);
    }
  }

  if (held) {
    lines.push(`Selected time pending confirmation: ${held.spokenLabel} (id: ${held.slotId})`);
    lines.push("Ask for explicit yes before confirming.");
  }

  if (canonical?.bookingReceiptPresent && ctx.session.bookingId) {
    lines.push(`Booking confirmed: ${ctx.session.bookingId}`);
  }

  const appointmentId = ctx.session.runtime.session_runtime?.foundAppointmentId;
  if (appointmentId && activeTask === "modify_appointment") {
    lines.push(`Located appointment: ${appointmentId}`);
  }

  return lines.join("\n");
}
