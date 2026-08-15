import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { missingReceptionistFields } from "@/lib/voice/receptionist/field-collection-scope";
import { applyReceptionistFieldBackfill } from "@/lib/voice/receptionist/field-backfill";
import { validateReceptionistFieldValue } from "@/lib/voice/receptionist/field-validation";
import { validateBookingNotesField } from "./booking-field-validation";
import { afterReceptionistFieldPersisted } from "./booking-field-coherence";
import { persistConfirmedBookingEmail } from "./booking-email-state";
import { FIELD_TRANSITION_BRIDGE_RULES } from "@/lib/voice/field-transition-bridge";
import { buildReceptionistFieldTransitionLine } from "@/lib/voice/receptionist/field-transition-phrases";
import type { FrontDeskUserData } from "./userdata";
import { deriveAuthoritativeBookingState } from "./booking-state";
import { logBookingIntake } from "./booking-intake-telemetry";
import { speakReceptionistCollectionLine } from "./receptionist/field-collection-task";
import { agentTaskSuperOptions, nestedTaskOptionsFromSession } from "../tasks/task-context";
import {
  markTaskCompleted,
  markTaskOnEnterStarted,
  markTaskStarted,
} from "../task-transition-instrumentation";
import {
  formatToolFeedbackForModel,
  toolFeedbackMissingCallerField,
  toolFeedbackRecoverable,
} from "@/lib/voice/tool-feedback";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";

export type BookingIntakeResult = {
  collected: string[];
  complete: boolean;
  fields: Record<string, string>;
};

const TASK_ID = "booking_intake";
const TASK_TYPE = "BookingIntakeTask";

function bookingRequirementFields(ud: FrontDeskUserData): AgentFieldDefinition[] {
  const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
  return missingReceptionistFields(manifest, ud.receptionistFields, "booking");
}

function syncBookingFieldsFromSession(
  session: AgentSession<FrontDeskUserData>,
  manifest: AgentFieldDefinition[],
): void {
  const ud = session.userData;
  if (!ud.receptionistFields) ud.receptionistFields = {};
  ud.receptionistFields = applyReceptionistFieldBackfill({
    chatCtx: session.chatCtx,
    manifest,
    receptionistFields: ud.receptionistFields,
    authoritativeFieldIds: ud.authoritativeFieldIds,
  });
  if (!ud.receptionistFields.phone?.trim() && ud.callerE164?.trim()) {
    const ani = tryNormalizeE164(ud.callerE164.trim());
    if (ani) ud.receptionistFields.phone = ani;
  }
}

function firstMissingField(
  ud: FrontDeskUserData,
  manifest: AgentFieldDefinition[],
): AgentFieldDefinition | undefined {
  const missing = bookingRequirementFields(ud);
  if (!missing.length) return undefined;
  return missing[0];
}

/**
 * Outcome-level booking intake — parent chat context, unordered multi-field collection,
 * authoritative state in FrontDeskUserData.
 */
export class BookingIntakeTask extends voice.AgentTask<BookingIntakeResult> {
  constructor(
    private readonly sessionRef: AgentSession<FrontDeskUserData>,
    private readonly requirementFields: AgentFieldDefinition[],
  ) {
    const manifest = sessionRef.userData.receptionistCompiled?.fieldManifest ?? [];
    const allowedIds = requirementFields.map((f) => f.id);
    const sessionCollectedIds: string[] = [];

    const persistField = (
      field: AgentFieldDefinition,
      rawValue: string,
      source: "primary" | "additional",
    ): { ok: true; normalized: string } | { ok: false; message: string } => {
      const trimmed = rawValue.trim();
      const ud = sessionRef.userData;
      logBookingIntake(ud.callId, "field_detected", {
        fieldId: field.id,
        source,
        preview: trimmed.slice(0, 48),
      });

      if (!trimmed) {
        return { ok: false, message: `Please provide your ${field.label}.` };
      }

      let normalized: string;
      try {
        if (field.id === "email" || field.type === "email") {
          const persisted = persistConfirmedBookingEmail(ud, trimmed);
          if (!persisted.ok) {
            logBookingIntake(ud.callId, "field_validation_failed", { fieldId: field.id });
            return { ok: false, message: "That email doesn't look right — could you say it again?" };
          }
          normalized = persisted.email;
        } else {
          const notesCheck = validateBookingNotesField(field.id, trimmed);
          if (!notesCheck.ok) {
            logBookingIntake(ud.callId, "field_validation_failed", {
              fieldId: field.id,
              reason: notesCheck.message,
            });
            return { ok: false, message: notesCheck.message };
          }
          normalized = validateReceptionistFieldValue(field, notesCheck.normalized);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : `Please provide your ${field.label}.`;
        logBookingIntake(ud.callId, "field_validation_failed", {
          fieldId: field.id,
          reason: message,
        });
        return { ok: false, message };
      }

      if (!ud.receptionistFields) ud.receptionistFields = {};
      const hadValue = ud.receptionistFields[field.id]?.trim();
      ud.receptionistFields[field.id] = normalized;
      const coherence = afterReceptionistFieldPersisted(ud, field.id, normalized, hadValue);
      if (coherence.corrected) {
        logBookingIntake(ud.callId, "field_corrected", {
          fieldId: field.id,
          previous: hadValue.slice(0, 32),
        });
      } else {
        logBookingIntake(ud.callId, "field_persisted", { fieldId: field.id });
      }
      if (coherence.slotInvalidated) {
        logBookingIntake(ud.callId, "slot_invalidated", { fieldId: field.id });
      }

      syncBookingFieldsFromSession(sessionRef, manifest);
      if (!sessionCollectedIds.includes(field.id)) {
        sessionCollectedIds.push(field.id);
      }

      const state = deriveAuthoritativeBookingState(ud);
      logBookingIntake(ud.callId, "requirements_recomputed", {
        missing: state.missingFields.map((g) => g.fieldId),
      });

      return { ok: true, normalized };
    };

    const finishIfComplete = async (): Promise<string | null> => {
      const ud = sessionRef.userData;
      const state = deriveAuthoritativeBookingState(ud);
      if (state.missingFields.length > 0) return null;

      logBookingIntake(ud.callId, "intake_complete", {
        collected: [...sessionCollectedIds],
      });
      const result: BookingIntakeResult = {
        collected: [...sessionCollectedIds],
        complete: true,
        fields: { ...(ud.receptionistFields || {}) },
      };
      markTaskCompleted({
        callId: ud.callId,
        taskId: TASK_ID,
        taskType: TASK_TYPE,
        complete: true,
        collectedCount: result.collected.length,
      });
      ud.bookingIntakeActive = false;
      ud.activeTaskInstrumentation = undefined;
      this.complete(result);
      return "All booking requirements satisfied — do not speak.";
    };

    const askNextMissing = async (afterField?: AgentFieldDefinition, afterValue?: string) => {
      const next = firstMissingField(sessionRef.userData, manifest);
      if (!next) return;
      const line =
        afterField && afterValue
          ? buildReceptionistFieldTransitionLine(afterField, afterValue, next)
          : next.question;
      await speakReceptionistCollectionLine(sessionRef, line);
    };

    const recordBookingFieldParams =
      allowedIds.length > 0
        ? z.object({
            field_id: z
              .enum(allowedIds as [string, ...string[]])
              .describe(`Booking field id. Options: ${allowedIds.join(", ")}`),
            value: z.string().describe("The caller's answer for that field"),
          })
        : z.object({
            field_id: z.string().describe("Booking field id"),
            value: z.string().describe("The caller's answer for that field"),
          });

    const recordBookingFieldTool = llm.tool({
      name: "record_booking_field",
      description:
        "Record any booking requirement the caller provided (name, phone, email, address, custom fields, preferred time). " +
        "Call immediately for every value they volunteer — fields may be satisfied in any order.",
      parameters: recordBookingFieldParams,
      execute: async ({ field_id, value }) => {
        const field = requirementFields.find((f) => f.id === field_id);
        if (!field) return `Field ${field_id} is not part of this booking intake.`;

        const saved = persistField(field, value, "additional");
        if (!saved.ok) {
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "record_booking_field",
              recovery_class: "INVALID_INFORMATION",
              reason: "validation_failed",
              field_id,
              field_label: field.label,
              next_action: "collect_field_then_retry",
              guidance: saved.message,
            }),
          );
        }

        const completeMsg = await finishIfComplete();
        if (completeMsg) return completeMsg;

        await askNextMissing(field, saved.normalized);
        return "Recorded — next question already asked. Do not speak.";
      },
    });

    super(
      agentTaskSuperOptions(
        {
          instructions:
            "Collect all booking requirements. The caller may provide multiple details in one answer — " +
            "call record_booking_field for each value immediately. " +
            "Required fields may be satisfied in any order. " +
            "Never re-ask for information already in authoritative state. " +
            FIELD_TRANSITION_BRIDGE_RULES +
            " When the caller answers, call record_booking_field without speaking. " +
            "The runtime asks for the next missing requirement.",
          tools: [recordBookingFieldTool],
        },
        nestedTaskOptionsFromSession(sessionRef),
      ),
    );
  }

  async onEnter(): Promise<void> {
    const ud = this.sessionRef.userData;
    const manifest = ud.receptionistCompiled?.fieldManifest ?? [];

    ud.bookingIntakeActive = true;
    syncBookingFieldsFromSession(this.sessionRef, manifest);

    markTaskStarted({
      callId: ud.callId,
      taskId: TASK_ID,
      taskType: TASK_TYPE,
    });
    markTaskOnEnterStarted({
      callId: ud.callId,
      taskId: TASK_ID,
      taskType: TASK_TYPE,
    });
    ud.activeTaskInstrumentation = {
      taskId: TASK_ID,
      taskType: TASK_TYPE,
    };

    const state = deriveAuthoritativeBookingState(ud);
    logBookingIntake(ud.callId, "requirements_recomputed", {
      missing: state.missingFields.map((g) => g.fieldId),
      onEnter: true,
    });

    if (state.missingFields.length === 0) {
      logBookingIntake(ud.callId, "intake_complete", { onEnter: true, alreadyComplete: true });
      ud.bookingIntakeActive = false;
      ud.activeTaskInstrumentation = undefined;
      markTaskCompleted({
        callId: ud.callId,
        taskId: TASK_ID,
        taskType: TASK_TYPE,
        complete: true,
        collectedCount: Object.keys(ud.receptionistFields || {}).length,
      });
      this.complete({
        collected: Object.keys(ud.receptionistFields || {}),
        complete: true,
        fields: { ...(ud.receptionistFields || {}) },
      });
      return;
    }

    const first = firstMissingField(ud, manifest);
    if (!first) return;

    if (ud.receptionistFieldCollectionPrefaceSpoken) {
      ud.receptionistFieldCollectionPrefaceSpoken = false;
      return;
    }

    await speakReceptionistCollectionLine(this.sessionRef, first.question);
  }
}

export async function runBookingIntakeTask(
  session: AgentSession<FrontDeskUserData>,
): Promise<BookingIntakeResult> {
  const manifest = session.userData.receptionistCompiled?.fieldManifest ?? [];
  syncBookingFieldsFromSession(session, manifest);
  const requirements = bookingRequirementFields(session.userData);
  const task = new BookingIntakeTask(session, requirements.length ? requirements : manifest.filter((f) => f.required));
  return task.run();
}
