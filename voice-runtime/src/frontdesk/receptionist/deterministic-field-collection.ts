import type { AgentSession } from "@livekit/agents";
import { buildReceptionistFieldTransitionLine } from "@/lib/voice/receptionist/field-transition-phrases";
import type { FrontDeskUserData } from "../userdata";
import type { ReceptionistCollectionPurpose } from "./workflow-types";
import {
  enterCollectionState,
  firstMissingFieldForPurpose,
} from "./workflow-engine";
import { speakReceptionistCollectionLine } from "./field-collection-task";

/** After runtime asks a collection question, force the model to call record_current_field. */
export async function forceRecordCurrentFieldTurn(
  session: AgentSession<FrontDeskUserData>,
): Promise<void> {
  const ud = session.userData;
  const field = ud.receptionistWorkflow?.activeFieldId || "the active field";
  await session.generateReply({
    instructions:
      `The caller is answering the question you just asked. ` +
      `Call record_current_field immediately with their answer for ${field}. ` +
      "Do not speak — only call the tool.",
    toolChoice: { type: "function", function: { name: "record_current_field" } },
  });
}

/**
 * Runtime-owned field collection — one conversational Amy, no child AgentTask / separate chat context.
 */
export async function beginDeterministicFieldCollection(
  session: AgentSession<FrontDeskUserData>,
  purpose: ReceptionistCollectionPurpose,
  options?: { skipFirstQuestion?: boolean },
): Promise<void> {
  const ud = session.userData;
  enterCollectionState(ud, purpose);

  const first = firstMissingFieldForPurpose(ud, purpose);
  if (!first?.question?.trim()) return;
  if (options?.skipFirstQuestion) return;

  await speakReceptionistCollectionLine(session, first.question, { addToChatCtx: true });
}

export async function askNextCollectionField(
  session: AgentSession<FrontDeskUserData>,
  purpose: ReceptionistCollectionPurpose,
  afterFieldId?: string,
  afterValue?: string,
): Promise<boolean> {
  const ud = session.userData;
  const next = firstMissingFieldForPurpose(ud, purpose);
  if (!next?.question?.trim()) return false;

  ud.receptionistWorkflow!.activeFieldId = next.id;

  let line = next.question;
  if (afterFieldId && afterValue) {
    const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
    const afterField = manifest.find((f) => f.id === afterFieldId);
    if (afterField) {
      line = buildReceptionistFieldTransitionLine(afterField, afterValue, next);
    }
  }

  await speakReceptionistCollectionLine(session, line, { addToChatCtx: true });
  return true;
}
