import type { AgentSession } from "@livekit/agents";
import { buildReceptionistFieldTransitionLine } from "@/lib/voice/receptionist/field-transition-phrases";
import type { FrontDeskUserData } from "../userdata";
import type { ReceptionistCollectionPurpose } from "./workflow-types";
import {
  beginCollectionPrompt,
  finishCollectionPrompt,
  logCollectionState,
} from "./collection-state-lifecycle";
import {
  enterCollectionState,
  firstMissingFieldForPurpose,
} from "./workflow-engine";
import { speakReceptionistCollectionLine } from "./field-collection-task";
import {
  assertSingleFieldCollectionPrompt,
  otherMissingFieldQuestionsReferenced,
} from "./collection-prompt-guard";
import {
  clearAllCollectionFragmentBuffers,
  hasIncompleteCollectionBuffer,
} from "./collection-fragment-buffer";

/** Atomic: set active field + phase, speak prompt, enter LISTENING. */
export async function promptCollectionField(
  session: AgentSession<FrontDeskUserData>,
  fieldId: string,
  line: string,
): Promise<void> {
  const ud = session.userData;
  const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
  const referenced = otherMissingFieldQuestionsReferenced(
    line,
    fieldId,
    manifest,
    ud.receptionistFields || {},
  );
  if (referenced.length > 0) {
    console.warn(
      JSON.stringify({
        source: "collection-prompt-guard",
        event: "collection_prompt_bundled_fields",
        callId: ud.callId,
        activeFieldId: fieldId,
        referencedOtherFields: referenced,
        promptPreview: line.slice(0, 160),
      }),
    );
    const field = manifest.find((f) => f.id === fieldId);
    if (field?.question?.trim()) {
      line = field.question.trim();
    }
  }
  assertSingleFieldCollectionPrompt(line, fieldId, manifest, ud.receptionistFields || {});

  logCollectionState(ud.callId, "collection_prompt_started", ud, {
    activeFieldId: fieldId,
    promptText: line.slice(0, 200),
  });
  beginCollectionPrompt(ud, fieldId);
  await speakReceptionistCollectionLine(session, line, { addToChatCtx: true });
  finishCollectionPrompt(ud, fieldId);
  logCollectionState(ud.callId, "prompt_finished", ud, { fieldId });
}

/**
 * Runtime-owned field collection — Amy speaks; runtime saves transcripts directly.
 */
export async function beginDeterministicFieldCollection(
  session: AgentSession<FrontDeskUserData>,
  purpose: ReceptionistCollectionPurpose,
  options?: { skipFirstQuestion?: boolean },
): Promise<void> {
  const ud = session.userData;
  clearAllCollectionFragmentBuffers(ud);
  enterCollectionState(ud, purpose);

  const first = firstMissingFieldForPurpose(ud, purpose);
  if (!first?.question?.trim()) return;
  if (options?.skipFirstQuestion) return;

  await promptCollectionField(session, first.id, first.question);
}

export async function askNextCollectionField(
  session: AgentSession<FrontDeskUserData>,
  purpose: ReceptionistCollectionPurpose,
  afterFieldId?: string,
  afterValue?: string,
): Promise<boolean> {
  const ud = session.userData;
  if (hasIncompleteCollectionBuffer(ud)) {
    console.log(
      JSON.stringify({
        source: "collection-state",
        event: "collection_next_prompt_suppressed",
        callId: ud.callId,
        reason: "incomplete_fragment_buffer",
        phoneBuffer: ud.collectionPhoneDigitsBuffer,
        fragmentBuffers: ud.collectionFieldFragmentBuffers,
      }),
    );
    return false;
  }

  const next = firstMissingFieldForPurpose(ud, purpose);
  if (!next?.question?.trim()) return false;

  if (next.type !== "phone" && next.id !== "phone") {
    ud.collectionPhoneDigitsBuffer = undefined;
  }

  let line = next.question;
  if (afterFieldId && afterValue) {
    const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
    const afterField = manifest.find((f) => f.id === afterFieldId);
    if (afterField) {
      line = buildReceptionistFieldTransitionLine(afterField, afterValue, next);
    }
  }

  await promptCollectionField(session, next.id, line);
  return true;
}

/** Re-ask after validation failure without advancing the field. */
export async function repromptActiveCollectionField(
  session: AgentSession<FrontDeskUserData>,
  guidance: string,
): Promise<void> {
  const ud = session.userData;
  const wf = ud.receptionistWorkflow;
  if (!wf?.activeFieldId) return;

  const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
  const field = manifest.find((f) => f.id === wf.activeFieldId);
  if (!field?.question?.trim()) return;

  const line = `${guidance} ${field.question}`;
  await promptCollectionField(session, wf.activeFieldId, line);
}
