import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { isConversationalIvrEditor } from "@/lib/receptionist/runtime-profile";
import { validateEditorForPublish } from "@/lib/server/receptionist/compile-runtime";
import { resolveWorkspaceOwnedPhoneNumberId } from "@/lib/server/receptionist/validate-phone-connection";
import { resolveSchedulingBackend } from "@/lib/server/voice-v3/scheduling/connections";
import { schedulingCapsForBackend } from "@/lib/server/voice-v3/scheduling/provider-capabilities";
import { findWorkspaceReceptionistAgent } from "@/lib/server/receptionist/agent-store";
import { buildKnowledgeCompileSlice } from "@/lib/server/receptionist/knowledge-compile";
import { receptionistHasPublishableAnswerKnowledge } from "@/lib/server/receptionist/answer-knowledge-publish";

const MAX_OPENAI_VECTOR_STORES_PER_PUBLISH = 2;

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

  try {
    await resolveWorkspaceOwnedPhoneNumberId(workspaceId, editor.connection);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid phone number assignment.");
  }

  if (
    !isConversationalIvrEditor(editor) &&
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

  if (!isConversationalIvrEditor(editor) && editor.capabilities.book && editor.appointments.strategy === "link") {
    if (!editor.appointments.bookingLink?.trim()) {
      errors.push("Booking link URL is required when using link booking strategy.");
    }
  }

  if (editor.capabilities.answer) {
    const agent = await findWorkspaceReceptionistAgent(workspaceId);
    if (agent) {
      const slice = await buildKnowledgeCompileSlice({
        workspaceId,
        agentId: agent.id,
      });
      const hasKnowledge = await receptionistHasPublishableAnswerKnowledge(
        workspaceId,
        editor,
        slice,
      );
      if (!hasKnowledge) {
        errors.push(
          "Knowledge: add business facts on the Knowledge page (Business knowledge) or link sources/FAQs before publishing answer capability.",
        );
      }
      if (slice.openaiVectorStoreIds.length > MAX_OPENAI_VECTOR_STORES_PER_PUBLISH) {
        errors.push(
          `Knowledge: at most ${MAX_OPENAI_VECTOR_STORES_PER_PUBLISH} linked vector stores can be active on a published agent (OpenAI limit). Unlink extra knowledge bases or consolidate content before publishing.`,
        );
      }
    } else {
      errors.push("Knowledge: create and link a knowledge base before publishing answer capability.");
    }
  }

  if (editor.capabilities.transfer) {
    if (isConversationalIvrEditor(editor)) {
      const routes = (editor.conversationalRoutes ?? []).filter(
        (r) => r.enabled && r.destinationPhoneE164?.trim(),
      );
      const legacy = editor.transfers.filter((t) => t.enabled && t.number?.trim());
      if (!routes.length && !legacy.length) {
        errors.push("Configure at least one semantic route with a Phone destination.");
      }
    } else {
      const enabled = editor.transfers.filter((t) => t.enabled && t.number?.trim());
      if (!enabled.length) {
        errors.push("Enable at least one transfer destination with a phone number.");
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
