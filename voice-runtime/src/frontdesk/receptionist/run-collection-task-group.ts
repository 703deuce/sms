import { workflows } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import {
  isEmailField,
  isPhoneField,
} from "@/lib/voice/receptionist/field-manifest-runtime";
import { applyReceptionistFieldBackfill } from "@/lib/voice/receptionist/field-backfill";
import type { FrontDeskUserData } from "../userdata";
import type { ReceptionistCollectionPurpose } from "./workflow-types";
import {
  missingFieldsForPurpose,
  ensureReceptionistWorkflow,
} from "./workflow-engine";
import { persistActiveFieldAnswer } from "./process-active-field-answer";
import { clearAllCollectionFragmentBuffers } from "./collection-fragment-buffer";
import {
  nestedTaskOptionsFromSession,
  taskGroupOptionsFromSession,
} from "../../tasks/task-context";
import { PhoneNumberCollectionTask } from "./tasks/phone-number-collection-task";
import { ManifestFieldCollectionTask } from "./tasks/manifest-field-collection-task";

export type ReceptionistCollectionTaskGroupResult = {
  collectedFieldIds: string[];
  complete: boolean;
};

function persistAdditionalField(
  session: AgentSession<FrontDeskUserData>,
  field: AgentFieldDefinition,
  value: string,
): { ok: boolean; message?: string } {
  const ud = session.userData;
  if (ud.receptionistFields?.[field.id]?.trim()) {
    return { ok: true };
  }
  const result = persistActiveFieldAnswer(ud, field.id, value, field);
  if (result.status === "saved") {
    return { ok: true };
  }
  if (result.status === "incomplete_phone") {
    return { ok: false, message: result.message };
  }
  return {
    ok: false,
    message: result.status === "invalid" ? result.message : "Could not save field.",
  };
}

/**
 * LiveKit TaskGroup collection — one discrete AgentTask per missing manifest field.
 * Semantic multi-field capture via record_additional_field inside each task.
 */
export async function runReceptionistCollectionTaskGroup(
  session: AgentSession<FrontDeskUserData>,
  purpose: ReceptionistCollectionPurpose,
): Promise<ReceptionistCollectionTaskGroupResult> {
  const ud = session.userData;
  const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
  if (!manifest.length) {
    return { collectedFieldIds: [], complete: true };
  }

  clearAllCollectionFragmentBuffers(ud);
  ud.receptionistCollectionTaskGroupActive = true;

  if (!ud.receptionistFields) ud.receptionistFields = {};
  ud.receptionistFields = applyReceptionistFieldBackfill({
    chatCtx: session.chatCtx,
    manifest,
    receptionistFields: ud.receptionistFields,
    authoritativeFieldIds: ud.authoritativeFieldIds,
  });

  const missing = missingFieldsForPurpose(ud, purpose);
  const collectedFieldIds: string[] = [];

  if (!missing.length) {
    ud.receptionistCollectionTaskGroupActive = false;
    return { collectedFieldIds, complete: true };
  }

  const taskContext = nestedTaskOptionsFromSession(session);
  const group = new workflows.TaskGroup({
    ...taskGroupOptionsFromSession(session),
    summarizeChatCtx: false,
    onTaskCompleted: async (event) => {
      const result = event.result as { fieldId?: string; phoneNumber?: string; value?: string };
      const fieldId = result?.fieldId;
      if (!fieldId) return;
      if (!collectedFieldIds.includes(fieldId)) {
        collectedFieldIds.push(fieldId);
      }
      const wf = ensureReceptionistWorkflow(ud);
      wf.activeFieldId = fieldId;
      console.log(
        JSON.stringify({
          source: "receptionist-collection-task-group",
          event: "task_field_completed",
          callId: ud.callId,
          fieldId,
          purpose,
        }),
      );
    },
  });

  for (const field of missing) {
    const otherIds = missing.filter((f) => f.id !== field.id).map((f) => f.id);
    const onAdditional = async (fieldId: string, value: string) => {
      const target = manifest.find((f) => f.id === fieldId);
      if (!target) return { ok: true };
      return persistAdditionalField(session, target, value);
    };

    if (isPhoneField(field)) {
      group.add(
        () => new PhoneNumberCollectionTask(field, session, otherIds, onAdditional),
        { id: field.id, description: `Collect ${field.label}` },
      );
      continue;
    }

    if (isEmailField(field)) {
      group.add(
        () => new ManifestFieldCollectionTask(field, session, otherIds, onAdditional),
        { id: field.id, description: `Collect ${field.label}` },
      );
      continue;
    }

    group.add(
      () => new ManifestFieldCollectionTask(field, session, otherIds, onAdditional),
      { id: field.id, description: `Collect ${field.label}` },
    );
  }

  console.log(
    JSON.stringify({
      source: "receptionist-collection-task-group",
      event: "task_group_started",
      callId: ud.callId,
      purpose,
      missingFieldIds: missing.map((f) => f.id),
    }),
  );

  try {
    await group.run();
  } finally {
    ud.receptionistCollectionTaskGroupActive = false;
  }

  const stillMissing = missingFieldsForPurpose(ud, purpose);
  return {
    collectedFieldIds,
    complete: stillMissing.length === 0,
  };
}
