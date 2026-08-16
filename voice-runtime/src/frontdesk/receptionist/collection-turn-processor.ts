import type { AgentSession } from "@livekit/agents";
import { captureUsPhoneDigits } from "@/lib/voice/receptionist/field-validation";
import type { FrontDeskUserData } from "../userdata";
import type { ReceptionistCollectionPurpose } from "./workflow-types";
import { ensureReceptionistWorkflow } from "./workflow-engine";
import {
  collectionStateSnapshot,
  finishCollectionPrompt,
  logCollectionState,
  markCollectionProcessing,
} from "./collection-state-lifecycle";
import {
  fieldIdsInManifestOrder,
  isPhoneField,
} from "@/lib/voice/receptionist/field-manifest-runtime";
import { extractFieldsFromUtterance } from "./collection-semantic-extractor";
import { classifyCollectionUtterance } from "./collection-utterance-validation";
import { persistActiveFieldAnswer } from "./process-active-field-answer";
import { repromptActiveCollectionField } from "./deterministic-field-collection";
import {
  getCollectionFragmentBuffer,
  hasIncompleteCollectionBuffer,
  mergeFragmentUtterance,
  setCollectionFragmentBuffer,
} from "./collection-fragment-buffer";

type TurnLog = (event: string, extra?: Record<string, unknown>) => void;

type CollectionTurnDeps = {
  log: TurnLog;
  logFieldSaveProgress: (
    ud: FrontDeskUserData,
    savedFieldId: string | undefined,
    savedValue: string | undefined,
  ) => void;
  clearCollectionStuckWatchdog: (ud: FrontDeskUserData) => void;
  advanceCollectionAfterFieldSaved: (
    session: AgentSession<FrontDeskUserData>,
    purpose: ReceptionistCollectionPurpose,
    savedFieldId?: string,
    savedValue?: string,
  ) => Promise<void>;
  handleAvailabilityRequest: (
    session: AgentSession<FrontDeskUserData>,
    transcript: string,
    turnId: number,
  ) => Promise<void>;
  handleCollectionClarification: (
    session: AgentSession<FrontDeskUserData>,
    transcript: string,
    turnId: number,
  ) => Promise<void>;
  bumpTurnId: (ud: FrontDeskUserData) => number;
};

function logFieldTransition(
  deps: CollectionTurnDeps,
  ud: FrontDeskUserData,
  input: {
    activeFieldBefore: string | undefined;
    transcript: string;
    normalizedValue?: string;
    validationResult: string;
    fieldComplete: boolean;
    activeFieldAfter: string | undefined;
    nextPromptRequested?: boolean;
  },
): void {
  deps.log("collection_field_transition", {
    active_field_before: input.activeFieldBefore,
    transcript: input.transcript.slice(0, 160),
    normalized_value: input.normalizedValue?.slice(0, 80),
    validation_result: input.validationResult,
    field_complete: input.fieldComplete,
    active_field_after: input.activeFieldAfter,
    next_prompt_requested: input.nextPromptRequested ?? false,
    fragment_buffer: ud.collectionPhoneDigitsBuffer || ud.collectionFieldFragmentBuffers,
    ...collectionStateSnapshot(ud),
  });
}

/**
 * One finalized caller turn during collection:
 * extract → validate → save → advance. No LLM tool calls for bookkeeping.
 */
export async function processCollectionTurn(
  session: AgentSession<FrontDeskUserData>,
  transcript: string,
  deps: CollectionTurnDeps,
): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  const purpose = wf.collectionPurpose || "booking";
  const normalizedTranscript = transcript.trim();
  const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
  const activeField = manifest.find((f) => f.id === wf.activeFieldId);
  const activeFieldBefore = wf.activeFieldId;
  const priorFragment = activeField ? getCollectionFragmentBuffer(ud, activeField) : "";

  markCollectionProcessing(ud);
  logCollectionState(ud.callId, "collection_turn_started", ud, {
    transcript: normalizedTranscript.slice(0, 160),
    fragment_buffer: priorFragment || undefined,
  });

  const utteranceKind = classifyCollectionUtterance(
    normalizedTranscript,
    activeField,
    priorFragment,
  );

  if (utteranceKind === "phone_partial" && activeField) {
    const capture = captureUsPhoneDigits(normalizedTranscript, priorFragment);
    if (capture.status === "incomplete") {
      setCollectionFragmentBuffer(ud, activeField, capture.digits);
    }
    deps.log("collection_phone_partial_buffered", {
      transcript: normalizedTranscript,
      buffer: capture.digits,
      ...collectionStateSnapshot(ud),
    });
    logFieldTransition(deps, ud, {
      activeFieldBefore,
      transcript: normalizedTranscript,
      validationResult: "incomplete_phone",
      fieldComplete: false,
      activeFieldAfter: wf.activeFieldId,
      nextPromptRequested: false,
    });
    if (wf.activeFieldId) finishCollectionPrompt(ud, wf.activeFieldId);
    return;
  }

  if (utteranceKind === "fragment_partial" && activeField) {
    const merged = mergeFragmentUtterance(activeField, priorFragment, normalizedTranscript);
    setCollectionFragmentBuffer(ud, activeField, merged);
    deps.log("collection_fragment_buffered", {
      transcript: normalizedTranscript,
      buffer: merged.slice(0, 80),
      fieldId: activeField.id,
      ...collectionStateSnapshot(ud),
    });
    logFieldTransition(deps, ud, {
      activeFieldBefore,
      transcript: normalizedTranscript,
      normalizedValue: merged,
      validationResult: "incomplete_fragment",
      fieldComplete: false,
      activeFieldAfter: wf.activeFieldId,
      nextPromptRequested: false,
    });
    if (wf.activeFieldId) finishCollectionPrompt(ud, wf.activeFieldId);
    return;
  }

  const turnId = deps.bumpTurnId(ud);
  const extraction = await extractFieldsFromUtterance(
    normalizedTranscript,
    manifest,
    ud.receptionistFields || {},
    {
      callerE164: ud.callerE164,
      activeFieldId: wf.activeFieldId,
      callId: ud.callId,
    },
  );

  if (extraction.skippedReason === "availability_request") {
    await deps.handleAvailabilityRequest(session, normalizedTranscript, turnId);
    return;
  }

  if (
    extraction.skippedReason === "meta_question" ||
    extraction.skippedReason === "business_question"
  ) {
    await deps.handleCollectionClarification(session, normalizedTranscript, turnId);
    return;
  }

  const extractedIds = Object.keys(extraction.fields);
  if (extractedIds.length > 0) {
    const saved: Array<{ fieldId: string; normalized: string }> = [];
    const orderedIds = fieldIdsInManifestOrder(manifest, extractedIds);
    const persistIds = wf.activeFieldId
      ? orderedIds.filter((id) => id === wf.activeFieldId)
      : orderedIds;

    if (wf.activeFieldId && orderedIds.some((id) => id !== wf.activeFieldId)) {
      deps.log("collection_volunteered_fields_ignored", {
        activeFieldId: wf.activeFieldId,
        ignoredFieldIds: orderedIds.filter((id) => id !== wf.activeFieldId),
      });
    }

    for (const fieldId of persistIds) {
      const raw = extraction.fields[fieldId];
      if (!raw?.trim()) continue;
      const field = manifest.find((f) => f.id === fieldId);
      if (!field) continue;
      const fragmentBuffer = getCollectionFragmentBuffer(ud, field);
      const mergedRaw = fragmentBuffer
        ? mergeFragmentUtterance(field, fragmentBuffer, raw)
        : raw;
      const result = persistActiveFieldAnswer(
        ud,
        fieldId,
        mergedRaw,
        field,
        isPhoneField(field) ? fragmentBuffer : "",
      );
      if (result.status === "saved") {
        saved.push({ fieldId: result.fieldId, normalized: result.normalized });
        logFieldTransition(deps, ud, {
          activeFieldBefore: activeFieldBefore,
          transcript: normalizedTranscript,
          normalizedValue: result.normalized,
          validationResult: "saved",
          fieldComplete: true,
          activeFieldAfter: wf.activeFieldId,
        });
      } else if (result.status === "incomplete_phone") {
        setCollectionFragmentBuffer(ud, field, result.digits);
        deps.log("collection_phone_partial_buffered", {
          transcript: normalizedTranscript,
          buffer: result.digits,
          fieldId,
        });
        logFieldTransition(deps, ud, {
          activeFieldBefore,
          transcript: normalizedTranscript,
          validationResult: "incomplete_phone",
          fieldComplete: false,
          activeFieldAfter: wf.activeFieldId,
        });
      } else if (result.status === "invalid") {
        deps.log("collection_field_invalid", {
          transcript: normalizedTranscript,
          fieldId: result.fieldId,
          message: result.message,
        });
      }
    }

    if (saved.length > 0 && !hasIncompleteCollectionBuffer(ud)) {
      deps.log("collection_fields_extracted", {
        transcript: normalizedTranscript,
        correction: extraction.correction,
        extractionSource: extraction.extractionSource ?? "deterministic",
        savedFieldIds: saved.map((s) => s.fieldId),
        ...collectionStateSnapshot(ud),
      });
      wf.collectionLastSavedTranscript = normalizedTranscript;
      deps.clearCollectionStuckWatchdog(ud);
      const last = saved[saved.length - 1];
      for (const item of saved) {
        deps.logFieldSaveProgress(ud, item.fieldId, item.normalized);
      }
      logFieldTransition(deps, ud, {
        activeFieldBefore,
        transcript: normalizedTranscript,
        normalizedValue: last.normalized,
        validationResult: "saved",
        fieldComplete: true,
        activeFieldAfter: wf.activeFieldId,
        nextPromptRequested: true,
      });
      await deps.advanceCollectionAfterFieldSaved(
        session,
        purpose,
        last.fieldId,
        last.normalized,
      );
      return;
    }
  }

  if (!wf.activeFieldId) {
    deps.log("collection_utterance_rejected", {
      transcript: normalizedTranscript,
      reason: "no_active_field",
      ...collectionStateSnapshot(ud),
    });
    return;
  }

  if (utteranceKind === "availability_request") {
    await deps.handleAvailabilityRequest(session, normalizedTranscript, turnId);
    return;
  }

  if (utteranceKind === "clarification") {
    await deps.handleCollectionClarification(session, normalizedTranscript, turnId);
    return;
  }

  if (utteranceKind !== "field_value") {
    deps.log("collection_utterance_rejected", {
      transcript: normalizedTranscript,
      utteranceKind,
      reason: "not_field_value",
      ...collectionStateSnapshot(ud),
    });
    return;
  }

  if (wf.collectionLastSavedTranscript === normalizedTranscript) {
    deps.log("collection_utterance_skipped_duplicate", {
      transcript: normalizedTranscript,
      ...collectionStateSnapshot(ud),
    });
    return;
  }

  const field = manifest.find((f) => f.id === wf.activeFieldId);
  if (!field) {
    deps.log("collection_utterance_rejected", {
      transcript: normalizedTranscript,
      reason: "unknown_active_field",
      activeFieldId: wf.activeFieldId,
    });
    return;
  }

  deps.log("collection_utterance_accepted", {
    transcript: normalizedTranscript,
    activeFieldId: wf.activeFieldId,
    path: "active_field_fallback",
    ...collectionStateSnapshot(ud),
  });

  const fragmentBuffer = getCollectionFragmentBuffer(ud, field);
  const mergedTranscript = fragmentBuffer
    ? mergeFragmentUtterance(field, fragmentBuffer, normalizedTranscript)
    : normalizedTranscript;

  const result = persistActiveFieldAnswer(
    ud,
    wf.activeFieldId,
    mergedTranscript,
    field,
    isPhoneField(field) ? fragmentBuffer : "",
  );

  if (result.status === "incomplete_phone") {
    setCollectionFragmentBuffer(ud, field, result.digits);
    logFieldTransition(deps, ud, {
      activeFieldBefore,
      transcript: normalizedTranscript,
      validationResult: "incomplete_phone",
      fieldComplete: false,
      activeFieldAfter: wf.activeFieldId,
    });
    finishCollectionPrompt(ud, wf.activeFieldId);
    return;
  }

  if (result.status === "invalid") {
    deps.log("collection_field_invalid", {
      transcript: normalizedTranscript,
      fieldId: result.fieldId,
      message: result.message,
    });
    logFieldTransition(deps, ud, {
      activeFieldBefore,
      transcript: normalizedTranscript,
      validationResult: "invalid",
      fieldComplete: false,
      activeFieldAfter: wf.activeFieldId,
    });
    await repromptActiveCollectionField(session, result.message);
    return;
  }

  if (result.status !== "saved") {
    finishCollectionPrompt(ud, wf.activeFieldId);
    return;
  }

  wf.collectionLastSavedTranscript = normalizedTranscript;
  deps.clearCollectionStuckWatchdog(ud);
  deps.logFieldSaveProgress(ud, result.fieldId, result.normalized);
  logFieldTransition(deps, ud, {
    activeFieldBefore,
    transcript: normalizedTranscript,
    normalizedValue: result.normalized,
    validationResult: "saved",
    fieldComplete: true,
    activeFieldAfter: wf.activeFieldId,
    nextPromptRequested: true,
  });
  await deps.advanceCollectionAfterFieldSaved(session, purpose, result.fieldId, result.normalized);
}
