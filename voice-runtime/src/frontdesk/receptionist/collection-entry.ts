import type { AgentSession } from "@livekit/agents";
import type { FrontDeskUserData } from "../userdata";
import type { ReceptionistCollectionPurpose } from "./workflow-types";
import {
  bookingFieldsComplete,
  enterCollectionState,
  messageFieldsComplete,
} from "./workflow-engine";
import {
  askNextCollectionField,
  beginDeterministicFieldCollection,
} from "./deterministic-field-collection";
import { runReceptionistCollectionTaskGroup } from "./run-collection-task-group";

/** TaskGroup collection unless legacy env or model already spoke the first question. */
export function receptionistTaskGroupCollectionEnabled(options?: {
  skipFirstQuestion?: boolean;
}): boolean {
  if (process.env.RECEPTIONIST_COLLECTION_LEGACY?.trim() === "1") return false;
  if (options?.skipFirstQuestion) return false;
  return true;
}

export type ReceptionistCollectionCompletionHandlers = {
  syncToolSurface: (session: AgentSession<FrontDeskUserData>) => Promise<void>;
  onBookingCollectionComplete: (
    session: AgentSession<FrontDeskUserData>,
    reason: string,
  ) => Promise<void>;
  onMessageCollectionComplete: (session: AgentSession<FrontDeskUserData>) => Promise<void>;
};

/**
 * Entry for manifest field collection — LiveKit TaskGroup when enabled, else transcript path.
 */
export async function beginReceptionistFieldCollection(
  session: AgentSession<FrontDeskUserData>,
  purpose: ReceptionistCollectionPurpose,
  options?: { skipFirstQuestion?: boolean },
  handlers?: ReceptionistCollectionCompletionHandlers,
): Promise<void> {
  if (!receptionistTaskGroupCollectionEnabled(options)) {
    await beginDeterministicFieldCollection(session, purpose, options);
    if (options?.skipFirstQuestion) {
      await askNextCollectionField(session, purpose);
    }
    return;
  }

  const ud = session.userData;
  enterCollectionState(ud, purpose);
  if (handlers) {
    await handlers.syncToolSurface(session);
  }

  const result = await runReceptionistCollectionTaskGroup(session, purpose);

  console.log(
    JSON.stringify({
      source: "collection-entry",
      event: "task_group_finished",
      callId: ud.callId,
      purpose,
      complete: result.complete,
      collectedFieldIds: result.collectedFieldIds,
    }),
  );

  if (!handlers) return;

  if (purpose === "booking" && result.complete && bookingFieldsComplete(ud)) {
    await handlers.onBookingCollectionComplete(session, "task_group_complete");
    return;
  }

  if (purpose === "message" && result.complete && messageFieldsComplete(ud)) {
    await handlers.onMessageCollectionComplete(session);
    return;
  }

  if (!result.complete) {
    console.log(
      JSON.stringify({
        source: "collection-entry",
        event: "task_group_incomplete_fallback",
        callId: ud.callId,
        purpose,
        collectedFieldIds: result.collectedFieldIds,
      }),
    );
    await beginDeterministicFieldCollection(session, purpose, { skipFirstQuestion: true });
    await askNextCollectionField(session, purpose);
  }
}
