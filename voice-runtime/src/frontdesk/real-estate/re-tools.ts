import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { takeStructuredMessage } from "@/lib/voice/domain-actions/take-structured-message";
import { searchCrmContactsForVoice } from "@/lib/voice/tools/crm-contact-search";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  applyPrimaryIntent,
  applySecondaryIntent,
  markMessageTaken,
  persistCallState,
} from "@/lib/voice/real-estate/state";
import { isIntentEnabled, missingIntakeFields, normalizeIntent } from "@/lib/voice/real-estate/fields";
import { notifyRealEstateStaff } from "@/lib/voice/real-estate/notifications";
import { syncRealEstateLeadToCrm } from "@/lib/voice/real-estate/crm-sync";
import { REAL_ESTATE_INTENT_LABELS, type RealEstateIntent } from "@/lib/voice/real-estate/types";
import { parseLocalContactIdFromSafeId } from "@/lib/voice/real-estate/contact-id";
import type { FrontDeskUserData } from "../userdata";
import { withLiveKitToolTelemetry } from "../../livekit-tool-telemetry";
import {
  formatToolFeedbackForModel,
  toolFeedbackTerminal,
} from "@/lib/voice/tool-feedback";
import {
  INTAKE_INTENTS,
  startIntakeSequenceFromTools,
  TOOL_RESULT_INTAKE_ACTIVE_SILENT,
  TOOL_RESULT_INTAKE_COMPLETE_SILENT,
  TOOL_RESULT_LOOKUP_SILENT,
  TOOL_RESULT_SET_INTENT_SILENT,
  intakeFieldsPending,
} from "./intake-lifecycle";

function activeIntents(userData: FrontDeskUserData): RealEstateIntent[] {
  const state = userData.callState;
  if (!state) return [];
  const intents: RealEstateIntent[] = [];
  if (state.primaryIntent) intents.push(state.primaryIntent);
  for (const secondary of state.secondaryIntents) {
    if (!intents.includes(secondary)) intents.push(secondary);
  }
  return intents;
}

async function syncState(userData: FrontDeskUserData): Promise<void> {
  if (!userData.callState) return;
  await persistCallState({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
  });
}

export function buildRealEstateIntentTools() {
  const setIntent = llm.tool({
    name: "set_intent",
    description:
      "Set the caller's primary intent silently. Never tell the caller you are routing or classifying them.",
    parameters: z.object({
      intent: z
        .enum([
          "buyer",
          "seller",
          "showing",
          "existing_client",
          "agent_to_agent",
          "general",
        ])
        .describe("Primary reason for the call"),
    }),
    execute: async ({ intent }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (!ud.callState) {
        return formatToolFeedbackForModel(
          toolFeedbackTerminal({
            tool: "set_intent",
            recovery_class: "UNKNOWN_FAILURE",
            reason: "call_state_missing",
            next_action: "take_message",
            guidance: "Session not ready — take a message for the team.",
          }),
        );
      }
      return withLiveKitToolTelemetry(ud, "set_intent", { intent }, async () => {
        if (!isIntentEnabled(intent)) {
          const fallback = ud.realEstateCompiled?.intents.general;
          if (fallback?.enabled) {
            ud.callState = applyPrimaryIntent(ud.callState!, "general");
          } else {
            return `${REAL_ESTATE_INTENT_LABELS[intent]} handling is not enabled for this account. Take a message or offer to connect them with the team.`;
          }
        } else {
          ud.callState = applyPrimaryIntent(ud.callState!, intent);
        }
        await syncState(ud);
        if (INTAKE_INTENTS.includes(intent) && intakeFieldsPending(ud)) {
          const { complete } = await startIntakeSequenceFromTools(session);
          return complete
            ? TOOL_RESULT_INTAKE_COMPLETE_SILENT
            : TOOL_RESULT_INTAKE_ACTIVE_SILENT;
        }
        return TOOL_RESULT_SET_INTENT_SILENT;
      });
    },
  });

  const addSecondaryIntent = llm.tool({
    name: "add_secondary_intent",
    description:
      "Add a secondary intent when the caller has multiple needs (e.g. buying and selling). Silent routing only.",
    parameters: z.object({
      intent: z
        .enum(["buyer", "seller", "showing", "existing_client", "agent_to_agent", "general"])
        .describe("Additional intent"),
    }),
    execute: async ({ intent }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (!ud.callState) {
        return formatToolFeedbackForModel(
          toolFeedbackTerminal({
            tool: "add_secondary_intent",
            recovery_class: "UNKNOWN_FAILURE",
            reason: "call_state_missing",
            next_action: "take_message",
            guidance: "Session not ready — take a message for the team.",
          }),
        );
      }
      return withLiveKitToolTelemetry(ud, "add_secondary_intent", { intent }, async () => {
        if (!isIntentEnabled(intent)) {
          return `${REAL_ESTATE_INTENT_LABELS[intent]} handling is not enabled. Continue with the primary intent or take a message.`;
        }
        ud.callState = applySecondaryIntent(ud.callState!, intent);
        await syncState(ud);
        if (INTAKE_INTENTS.includes(intent) && intakeFieldsPending(ud)) {
          const { complete } = await startIntakeSequenceFromTools(session);
          return complete
            ? TOOL_RESULT_INTAKE_COMPLETE_SILENT
            : TOOL_RESULT_INTAKE_ACTIVE_SILENT;
        }
        return TOOL_RESULT_SET_INTENT_SILENT;
      });
    },
  });

  return [setIntent, addSecondaryIntent];
}

export function buildRealEstateCollectRequiredFieldsTool() {
  return llm.tool({
    name: "collect_required_fields",
    description:
      "Run LiveKit field-collection tasks for all missing required fields after set_intent. " +
      "Call once when ready to gather intake — do not collect fields one-by-one manually.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (!ud.callState) {
        return formatToolFeedbackForModel(
          toolFeedbackTerminal({
            tool: "collect_required_fields",
            recovery_class: "UNKNOWN_FAILURE",
            reason: "call_state_missing",
            next_action: "take_message",
            guidance: "Session not ready — take a message for the team.",
          }),
        );
      }
      return withLiveKitToolTelemetry(ud, "collect_required_fields", {}, async () => {
        if (ud.intakeSequenceActive) {
          return TOOL_RESULT_INTAKE_ACTIVE_SILENT;
        }
        if (!intakeFieldsPending(ud)) {
          const intents = activeIntents(ud);
          const complete =
            intents.length > 0 &&
            !missingIntakeFields(
              intents,
              ud.callState!.collectedFields,
              ud.realEstateCompiled,
            ).length;
          return complete
            ? TOOL_RESULT_INTAKE_COMPLETE_SILENT
            : TOOL_RESULT_SET_INTENT_SILENT;
        }
        const result = await startIntakeSequenceFromTools(session);
        if (result.complete) {
          return TOOL_RESULT_INTAKE_COMPLETE_SILENT;
        }
        return TOOL_RESULT_INTAKE_ACTIVE_SILENT;
      });
    },
  });
}

export function buildRealEstateGetRequiredFieldsTool() {
  return llm.tool({
    name: "get_required_fields",
    description: "Read-only summary of intake fields and what is still missing.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      const intents = activeIntents(ud);
      if (!intents.length) return "Set intent first with set_intent.";
      const missing = missingIntakeFields(
        intents,
        ud.callState?.collectedFields || {},
        ud.realEstateCompiled,
      );
      if (!missing.length) return "All required fields collected.";
      return `Still missing field ids: ${missing.map((f) => f.field_id).join(", ")}`;
    },
  });
}

export function buildRealEstateLookupContactTool() {
  return llm.tool({
    name: "lookup_contact",
    description:
      "Look up an existing contact by phone, email, or name. Call at start of call or when caller identifies themselves.",
    parameters: z.object({
      phone: z.string().optional().describe("Phone number to search"),
      email: z.string().optional().describe("Email to search"),
      name: z.string().optional().describe("Name to search"),
    }),
    execute: async ({ phone, email, name }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "lookup_contact", { phone, email, name }, async () => {
        const searchPhone = phone?.trim() || ud.callerE164?.trim() || "";
        const result = await searchCrmContactsForVoice({
          workspaceId: ud.workspaceId,
          phone: searchPhone || undefined,
          email: email?.trim() || undefined,
          query: name?.trim() || undefined,
          limit: 3,
        });

        if (!result.matches.length) {
          return TOOL_RESULT_LOOKUP_SILENT;
        }

        const first = result.matches[0]!;
        if (ud.callState) {
          ud.callState.contactName = first.displayName;
          const localContactId = parseLocalContactIdFromSafeId(first.safeId);
          if (localContactId) {
            ud.callState.contactId = localContactId;
          }
          if (first.displayName) {
            ud.callState.collectedFields = {
              ...ud.callState.collectedFields,
              name: ud.callState.collectedFields.name || first.displayName,
            };
          }
          if (first.email && !ud.callState.collectedFields.email) {
            ud.callState.collectedFields.email = first.email;
          }
          if (searchPhone && !ud.callState.collectedFields.callback_phone) {
            try {
              ud.callState.collectedFields.callback_phone = normalizeE164(searchPhone);
            } catch {
              ud.callState.collectedFields.callback_phone = searchPhone;
            }
          }
          await syncState(ud);
        }

        return TOOL_RESULT_LOOKUP_SILENT;
      });
    },
  });
}

export function buildRealEstateTakeMessageTool() {
  return llm.tool({
    name: "take_message",
    description:
      "Take a structured message for staff when the caller does not want to book or needs a callback.",
    parameters: z.object({
      reason: z.string().describe("Main message or reason for callback"),
      caller_name: z.string().optional().describe("Caller name if known"),
      urgency: z.enum(["low", "normal", "high"]).optional().describe("Urgency level"),
      preferred_callback: z.string().optional().describe("When to call back"),
      notes: z.string().optional().describe("Additional notes"),
    }),
    execute: async ({ reason, caller_name, urgency, preferred_callback, notes }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "take_message", { reason }, async () => {
        const name =
          caller_name?.trim() ||
          ud.callState?.collectedFields.name ||
          ud.callState?.contactName ||
          "";
        const phone = ud.callState?.collectedFields.callback_phone || ud.callerE164 || "";

        await takeStructuredMessage({
          workspaceId: ud.workspaceId,
          callId: ud.callId,
          reason,
          caller_name: name,
          phone,
          urgency: urgency || "normal",
          preferred_callback,
          notes,
        });

        if (ud.callState) {
          ud.callState = markMessageTaken(ud.callState);
          await syncState(ud);
          void syncRealEstateLeadToCrm({
            workspaceId: ud.workspaceId,
            callId: ud.callId,
            callState: ud.callState,
            callerE164: ud.callerE164,
            businessName: ud.businessName,
            trigger: "message_taken",
          }).catch(() => undefined);
          void notifyRealEstateStaff({
            workspaceId: ud.workspaceId,
            callId: ud.callId,
            callState: ud.callState,
            businessName: ud.businessName,
            event: "message_taken",
            callerE164: ud.callerE164,
          }).catch(() => undefined);
        }

        return "Message recorded. Tell the caller someone from the team will follow up.";
      });
    },
  });
}

/** @deprecated Use buildRealEstateCollectRequiredFieldsTool */
export function buildRealEstateFieldTools() {
  throw new Error("buildRealEstateFieldTools removed — use buildRealEstateCollectRequiredFieldsTool");
}

/** Expose normalizeIntent for instruction hints */
export { normalizeIntent };
