import { workflows } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import type { RealEstateFieldDefinition, RealEstateIntent } from "@/lib/voice/real-estate/types";
import {
  fieldsForIntents,
  isIntakeComplete,
  missingRequiredFields,
} from "@/lib/voice/real-estate/fields";
import { backfillIntakeFromConversation } from "@/lib/voice/real-estate/intake-memory";
import {
  persistCallState,
  recordCollectedField,
} from "@/lib/voice/real-estate/state";
import { notifyRealEstateStaff } from "@/lib/voice/real-estate/notifications";
import { syncRealEstateLeadToCrm } from "@/lib/voice/real-estate/crm-sync";
import type { FrontDeskUserData } from "../userdata";
import { SchemaFieldCollectionTask } from "../../tasks/schema-field-collection-task";
import { taskGroupOptionsFromSession } from "../../tasks/task-context";

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

function pendingFieldsForTask(
  currentField: RealEstateFieldDefinition,
  toCollect: RealEstateFieldDefinition[],
  allFields: RealEstateFieldDefinition[],
  collected: Record<string, string>,
): RealEstateFieldDefinition[] {
  const pending: RealEstateFieldDefinition[] = [];
  for (const field of allFields) {
    if (field.field_id === currentField.field_id) continue;
    if (toCollect.some((f) => f.field_id === field.field_id)) {
      pending.push(field);
      continue;
    }
    if (!field.required && !collected[field.field_id]?.trim()) {
      pending.push(field);
    }
  }
  return pending;
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
  userData.callState = await backfillIntakeFromConversation({
    state: userData.callState,
    chatCtx: input.session.chatCtx,
    candidateFields: allFields,
  });
  await syncIntakeSideEffects(userData);

  const toCollect =
    input.fields ||
    missingRequiredFields(intents, userData.callState.collectedFields);

  if (!toCollect.length) {
    return { collected: [], complete: isIntakeComplete(intents, userData.callState.collectedFields) };
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
    await syncIntakeSideEffects(userData);
    return { ok: true };
  };

  const group = new workflows.TaskGroup({
    ...taskGroupOptionsFromSession(input.session),
    onTaskCompleted: async () => {
      await syncIntakeSideEffects(userData);
    },
  });

  for (const field of toCollect) {
    const pendingFields = pendingFieldsForTask(
      field,
      toCollect,
      allFields,
      userData.callState.collectedFields,
    );
    group.add(
      () =>
        new SchemaFieldCollectionTask(field, input.session, {
          onRecord: async (value) => {
            await recordIntakeField(field, value);
            return { ok: true };
          },
          pendingFields,
          onRecordAdditionalField: async (fieldId, value) => {
            const target = allFields.find((f) => f.field_id === fieldId);
            if (!target) {
              return { ok: true };
            }
            const already = userData.callState?.collectedFields[fieldId]?.trim();
            if (already) {
              return { ok: true };
            }
            await recordIntakeField(target, value);
            return { ok: true };
          },
        }),
      { id: field.field_id, description: `Collect ${field.label}` },
    );
  }

  // AgentTask.run() pauses the parent activity (not drain) so onEnter generateReply
  // can speak while the tool is still executing. Manual updateAgent() before run()
  // drains scheduling and leaves the caller hearing silence after intake starts.
  await group.run();

  userData.callState = await backfillIntakeFromConversation({
    state: userData.callState,
    chatCtx: input.session.chatCtx,
    candidateFields: allFields,
  });
  await syncIntakeSideEffects(userData);

  const complete = isIntakeComplete(intents, userData.callState.collectedFields);
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
