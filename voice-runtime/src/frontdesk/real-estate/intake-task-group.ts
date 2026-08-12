import type { AgentSession } from "@livekit/agents";
import type { RealEstateFieldDefinition, RealEstateIntent } from "@/lib/voice/real-estate/types";
import {
  fieldsForIntents,
  missingContactFollowUpFields,
  missingIntakeFields,
  missingRequiredFields,
} from "@/lib/voice/real-estate/fields";
import {
  applyHeuristicIntakeBackfill,
  backfillIntakeFromConversation,
} from "@/lib/voice/real-estate/intake-memory";
import {
  persistCallState,
  recordCollectedField,
} from "@/lib/voice/real-estate/state";
import { notifyRealEstateStaff } from "@/lib/voice/real-estate/notifications";
import { syncRealEstateLeadToCrm } from "@/lib/voice/real-estate/crm-sync";
import type { FrontDeskUserData } from "../userdata";
import { runIntakeSequenceCollectionTask } from "./intake-sequence-collection-task";

function queueIntakeSideEffects(userData: FrontDeskUserData): void {
  if (!userData.callState) return;
  void persistCallState({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
  }).catch(() => undefined);
}

async function syncIntakeSideEffects(userData: FrontDeskUserData): Promise<void> {
  if (!userData.callState) return;
  await persistCallState({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
  });
}

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

function isIntakeCompleteForIntents(
  intents: RealEstateIntent[],
  userData: FrontDeskUserData,
): boolean {
  const collected = userData.callState?.collectedFields || {};
  return (
    missingRequiredFields(intents, collected).length === 0 &&
    missingContactFollowUpFields(
      intents,
      collected,
      userData.realEstateCompiled,
    ).length === 0
  );
}

export async function runRealEstateIntakeTaskGroup(input: {
  session: AgentSession<FrontDeskUserData>;
  fields?: RealEstateFieldDefinition[];
}): Promise<{ collected: string[]; complete: boolean }> {
  const userData = input.session.userData;
  if (!userData.callState) {
    throw new Error("Call state not initialized");
  }

  const intents = activeIntents(userData);

  const allFields = fieldsForIntents(intents);
  // Fast heuristic only before first intake speech — full LLM backfill runs after (was blocking ~1–3s).
  userData.callState = applyHeuristicIntakeBackfill({
    state: userData.callState,
    chatCtx: input.session.chatCtx,
    candidateFields: allFields,
  });
  queueIntakeSideEffects(userData);

  const toCollect =
    input.fields ||
    missingIntakeFields(
      intents,
      userData.callState.collectedFields,
      userData.realEstateCompiled,
    );

  if (!toCollect.length) {
    const complete = isIntakeCompleteForIntents(intents, userData);
    return { collected: [], complete };
  }

  const collected: string[] = [];

  const recordIntakeField = async (
    field: RealEstateFieldDefinition,
    value: string,
  ): Promise<{ ok: boolean }> => {
    userData.callState = recordCollectedField(userData.callState!, field.field_id, value);
    if (field.field_id === "name") {
      userData.callState!.contactName = value.trim();
    }
    if (!collected.includes(field.field_id)) {
      collected.push(field.field_id);
    }
    queueIntakeSideEffects(userData);
    return { ok: true };
  };

  // One AgentTask for the full intake sequence — avoids per-field activity handoffs
  // that cause multi-second silence on OpenAI Realtime.
  const sequenceResult = await runIntakeSequenceCollectionTask({
    session: input.session,
    handlers: {
      fieldsToCollect: toCollect,
      allFields,
      onRecordField: recordIntakeField,
      onRecordAdditionalField: async (fieldId, value) => {
        const target = allFields.find((f) => f.field_id === fieldId);
        if (!target) {
          return { ok: true };
        }
        const already = userData.callState?.collectedFields[fieldId]?.trim();
        if (already) {
          return { ok: true };
        }
        return await recordIntakeField(target, value);
      },
      isIntakeComplete: () => isIntakeCompleteForIntents(intents, userData),
    },
  });

  for (const fieldId of sequenceResult.collected) {
    if (!collected.includes(fieldId)) {
      collected.push(fieldId);
    }
  }

  await syncIntakeSideEffects(userData);

  // Full LLM extraction after intake spoke — does not delay first field question.
  void (async () => {
    if (!userData.callState) return;
    try {
      userData.callState = await backfillIntakeFromConversation({
        state: userData.callState,
        chatCtx: input.session.chatCtx,
        candidateFields: allFields,
      });
      await syncIntakeSideEffects(userData);
    } catch {
      // intake already progressed; backfill is best-effort
    }
  })();

  const complete = isIntakeCompleteForIntents(intents, userData);
  if (complete && userData.callState) {
    void syncRealEstateLeadToCrm({
      workspaceId: userData.workspaceId,
      callId: userData.callId,
      callState: userData.callState,
      callerE164: userData.callerE164,
      businessName: userData.businessName,
      trigger: "intake_complete",
    }).catch(() => undefined);
    void notifyRealEstateStaff({
      workspaceId: userData.workspaceId,
      callId: userData.callId,
      callState: userData.callState,
      businessName: userData.businessName,
      event: "intake_complete",
      callerE164: userData.callerE164,
    }).catch(() => undefined);
  }

  return { collected, complete };
}

export function summarizeIntakeFields(userData: FrontDeskUserData): string {
  const intents = activeIntents(userData);
  if (!intents.length) {
    return "Set intent first with set_intent.";
  }
  const allFields = fieldsForIntents(intents);
  const missing = missingRequiredFields(intents, userData.callState?.collectedFields || {});
  const lines = allFields.map((f) => {
    const collected = userData.callState?.collectedFields[f.field_id];
    const status = collected ? `[collected]` : f.required ? "[required]" : "[optional]";
    return `${f.field_id} (${f.label}) ${status}`;
  });
  return [
    `Intents: ${intents.join(" + ")}`,
    missing.length
      ? `Still missing: ${missing.map((f) => f.field_id).join(", ")}`
      : "All required fields collected.",
    ...lines,
  ].join("\n");
}
