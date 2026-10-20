import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { validateEditorForPublish } from "@/lib/server/receptionist/compile-runtime";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceOwnedPhoneNumberId } from "@/lib/server/receptionist/validate-phone-connection";
import { resolveSchedulingBackend } from "@/lib/server/voice-v3/scheduling/connections";
import { schedulingCapsForBackend } from "@/lib/server/voice-v3/scheduling/provider-capabilities";

/**
 * Publish must fail when enabled capabilities lack a working backend adapter.
 */
export async function validateReceptionistPublish(
  workspaceId: string,
  editor: AgentConfig,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const base = validateEditorForPublish(editor);
  if (!base.ok) return base;

  const errors: string[] = [];
  const prisma = getPrisma();

  try {
    await resolveWorkspaceOwnedPhoneNumberId(workspaceId, editor.connection);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid phone number assignment.");
  }

  if (
    (editor.capabilities.book || editor.capabilities.reschedule || editor.capabilities.cancel) &&
    editor.appointments.strategy === "live"
  ) {
    const backend = await resolveSchedulingBackend(workspaceId, editor);
    if (!backend.ok) {
      errors.push(backend.message);
    } else {
      const caps = schedulingCapsForBackend(backend);
      if (editor.capabilities.reschedule && !caps.rescheduleAppointment) {
        errors.push(
          "Reschedule is enabled but the connected calendar (Calendly) does not support in-call reschedule — disable reschedule or switch to Microsoft/Google.",
        );
      }
      if (editor.capabilities.cancel && !caps.cancelAppointment) {
        errors.push("Cancel is enabled but the calendar provider does not support cancellation.");
      }
      if (
        (editor.capabilities.reschedule || editor.capabilities.cancel) &&
        !caps.findAppointment
      ) {
        errors.push("Appointment lookup is required for reschedule/cancel but is unavailable.");
      }
    }
  }

  if (editor.capabilities.book && editor.appointments.strategy === "link") {
    if (!editor.appointments.bookingLink?.trim()) {
      errors.push("Booking link URL is required when using link booking strategy.");
    }
  }

  if (editor.capabilities.answer) {
    const kb = await prisma.voiceKnowledgeBase.findFirst({
      where: { workspaceId, status: "active" },
    });
    const faqCount = kb
      ? await prisma.voiceKnowledgeSource.count({
          where: { workspaceId, knowledgeBaseId: kb.id, sourceType: "faq" },
        })
      : 0;
    if (!kb && faqCount === 0) {
      errors.push("Knowledge: add FAQs or a knowledge source before publishing answer capability.");
    }
  }

  if (editor.capabilities.transfer) {
    const enabled = editor.transfers.filter((t) => t.enabled && t.number?.trim());
    if (!enabled.length) {
      errors.push("Enable at least one transfer destination with a phone number.");
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
