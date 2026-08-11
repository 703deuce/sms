import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { executeBuiltinVoiceAction } from "@/lib/voice/tools/builtin-actions";
import { searchCrmContactsForVoice } from "@/lib/voice/tools/crm-contact-search";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  applyPrimaryIntent,
  applySecondaryIntent,
  buildMissingFieldsSummary,
  markMessageTaken,
  persistCallState,
  recordCollectedField,
} from "@/lib/voice/real-estate/state";
import {
  fieldsForIntents,
  missingRequiredFields,
  normalizeIntent,
} from "@/lib/voice/real-estate/fields";
import { notifyRealEstateStaff } from "@/lib/voice/real-estate/notifications";
import { syncRealEstateLeadToCrm } from "@/lib/voice/real-estate/crm-sync";
import { REAL_ESTATE_INTENT_LABELS, type RealEstateIntent } from "@/lib/voice/real-estate/types";
import { parseLocalContactIdFromSafeId } from "@/lib/voice/real-estate/contact-id";
import type { FrontDeskUserData } from "../userdata";
import { withLiveKitToolTelemetry } from "../../livekit-tool-telemetry";

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
        throw new llm.ToolError("Call state not initialized.");
      }
      return withLiveKitToolTelemetry(ud, "set_intent", { intent }, async () => {
        ud.callState = applyPrimaryIntent(ud.callState!, intent);
        await syncState(ud);
        const missing = buildMissingFieldsSummary(ud.callState);
        return `Intent set to ${REAL_ESTATE_INTENT_LABELS[intent]}. ${missing}`;
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
        throw new llm.ToolError("Call state not initialized.");
      }
      return withLiveKitToolTelemetry(ud, "add_secondary_intent", { intent }, async () => {
        ud.callState = applySecondaryIntent(ud.callState!, intent);
        await syncState(ud);
        const missing = buildMissingFieldsSummary(ud.callState);
        return `Added secondary intent: ${REAL_ESTATE_INTENT_LABELS[intent]}. ${missing}`;
      });
    },
  });

  return [setIntent, addSecondaryIntent];
}

export function buildRealEstateFieldTools() {
  return llm.tool({
    name: "record_collected_field",
    description:
      "Save a field the caller provided. Use field_id from the required fields for their intent.",
    parameters: z.object({
      field_id: z.string().describe("Field identifier, e.g. target_areas, property_address, name"),
      value: z.string().describe("What the caller said"),
    }),
    execute: async ({ field_id, value }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (!ud.callState) {
        throw new llm.ToolError("Call state not initialized.");
      }
      return withLiveKitToolTelemetry(
        ud,
        "record_collected_field",
        { field_id },
        async () => {
          ud.callState = recordCollectedField(ud.callState!, field_id, value);
          if (field_id === "name") {
            ud.callState.contactName = value.trim();
          }
          await syncState(ud);

          const intents = activeIntents(ud);
          if (!intents.length) {
            return "Saved. Call set_intent first to know which fields to collect.";
          }

          const missing = missingRequiredFields(intents, ud.callState.collectedFields);
          if (!missing.length && ud.callState.intakeComplete) {
            void syncRealEstateLeadToCrm({
              workspaceId: ud.workspaceId,
              callId: ud.callId,
              callState: ud.callState,
              callerE164: ud.callerE164,
              businessName: ud.businessName,
              trigger: "intake_complete",
            }).catch(() => undefined);
            void notifyRealEstateStaff({
              workspaceId: ud.workspaceId,
              callId: ud.callId,
              callState: ud.callState,
              businessName: ud.businessName,
              event: "intake_complete",
              callerE164: ud.callerE164,
            }).catch(() => undefined);
            return "All required fields collected. Offer to schedule a consultation or take a message if they prefer.";
          }

          const next = missing[0];
          return next
            ? `Saved ${field_id}. Next collect: ${next.label} — ${next.collection_instruction}`
            : `Saved ${field_id}.`;
        },
      );
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
          return result.speak || "No existing contact found. Proceed with intake.";
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

        return (
          result.speak ||
          `Found ${first.displayName}. Use their info when collecting fields — confirm details rather than re-asking.`
        );
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

        await executeBuiltinVoiceAction({
          workspaceId: ud.workspaceId,
          agentId: ud.agentId,
          callId: ud.callId,
          toolType: "take_structured_message",
          input: {
            reason,
            caller_name: name,
            phone,
            urgency: urgency || "normal",
            preferred_callback,
            notes,
          },
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

export function buildRealEstateGetRequiredFieldsTool() {
  return llm.tool({
    name: "get_required_fields",
    description:
      "Get the list of fields still needed for the caller's intent(s). Call after set_intent to plan collection.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      const intents = activeIntents(ud);
      if (!intents.length) {
        return "No intent set yet. Infer intent from conversation and call set_intent.";
      }
      const allFields = fieldsForIntents(intents);
      const missing = missingRequiredFields(intents, ud.callState?.collectedFields || {});
      const lines = allFields.map((f) => {
        const collected = ud.callState?.collectedFields[f.field_id];
        const status = collected ? `[collected: ${collected}]` : f.required ? "[required]" : "[optional]";
        return `${f.field_id} (${f.label}) ${status}: ${f.collection_instruction}`;
      });
      return [
        `Intents: ${intents.map((i) => REAL_ESTATE_INTENT_LABELS[i]).join(" + ")}`,
        missing.length
          ? `Missing required: ${missing.map((f) => f.field_id).join(", ")}`
          : "All required fields collected.",
        ...lines,
      ].join("\n");
    },
  });
}

/** Expose normalizeIntent for instruction hints */
export { normalizeIntent };
