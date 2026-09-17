import "server-only";

import type { LiveControlPlane } from "./live-control-plane";
import type { LiveToolDispatchContext } from "./live-tool-runtime";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import type { StableCallerUtterance } from "./live-caller-utterance-assembler";
import { createPendingStableUtteranceQueue } from "./live-pending-stable-utterances";
import {
  syncLiveCallerUtteranceIntent,
  type SyncLiveCallerUtteranceIntentResult,
} from "./live-caller-intent-sync";

export type LiveStableUtteranceIngressDeps = {
  claims: RealtimeBridgeStreamClaims;
  controlPlane: LiveControlPlane;
  dispatchContext: LiveToolDispatchContext;
  sendLiveOut: (event: Record<string, unknown>) => void;
  fullConversationTranscript: () => string;
  liveSessionId?: string | null;
};

export type LiveStableUtteranceIngress = {
  markControlPlaneReady: (reason: string) => void;
  isInterpretationReady: () => boolean;
  ingestStableUtterance: (stable: StableCallerUtterance) => Promise<SyncLiveCallerUtteranceIntentResult | null>;
  pendingCount: () => number;
};

/**
 * Production stable-utterance → semantic sync path (queue until control plane ready, then syncLiveCallerUtteranceIntent).
 * Used by live-media-bridge and orchestration/ingress tests.
 */
export function createLiveStableUtteranceIngress(input: {
  callId: string;
  getDeps: () => LiveStableUtteranceIngressDeps | null;
}): LiveStableUtteranceIngress {
  const pendingStableUtterances = createPendingStableUtteranceQueue();
  let controlPlaneReady = false;

  const interpretAndApplyStableUtterance = async (
    stable: StableCallerUtterance,
  ): Promise<SyncLiveCallerUtteranceIntentResult | null> => {
    const deps = input.getDeps();
    if (!deps) {
      console.info(
        `VOICE_STABLE_UTTERANCE_FAILED ${JSON.stringify({
          call_id: input.callId,
          utterance_id: stable.utterance_id,
          revision: stable.revision,
          reason: "interpretation_deps_not_ready",
        })}`,
      );
      return { terminal: "failed", reason: "interpretation_deps_not_ready" };
    }
    return syncLiveCallerUtteranceIntent({
      claims: deps.claims,
      callerUtterance: stable.text,
      fullConversationTranscript: deps.fullConversationTranscript(),
      stableUtterance: stable,
      controlPlane: deps.controlPlane,
      sendLiveOut: deps.sendLiveOut,
      dispatchContext: deps.dispatchContext,
      autoDispatch: true,
    });
  };

  return {
    isInterpretationReady() {
      return controlPlaneReady && Boolean(input.getDeps());
    },

    markControlPlaneReady(reason: string) {
      if (controlPlaneReady) return;
      controlPlaneReady = true;
      const deps = input.getDeps();
      console.info(
        `CONTROL_PLANE_READY ${JSON.stringify({
          call_id: input.callId,
          live_session_id: deps?.liveSessionId ?? null,
          reason,
          queued_utterances: pendingStableUtterances.size(),
        })}`,
      );
      const queued = pendingStableUtterances.drain();
      for (const utterance of queued) {
        console.info(
          `VOICE_STABLE_UTTERANCE_REPLAY ${JSON.stringify({
            call_id: input.callId,
            live_session_id: deps?.liveSessionId ?? null,
            utterance_id: utterance.utterance_id,
            revision: utterance.revision,
          })}`,
        );
        void interpretAndApplyStableUtterance(utterance);
      }
    },

    pendingCount() {
      return pendingStableUtterances.size();
    },

    async ingestStableUtterance(stable: StableCallerUtterance) {
      console.info(
        `STABLE_UTTERANCE_CREATED ${JSON.stringify({
          call_id: input.callId,
          live_session_id: input.getDeps()?.liveSessionId ?? null,
          utterance_id: stable.utterance_id,
          revision: stable.revision,
          text_chars: stable.text.length,
        })}`,
      );

      if (!this.isInterpretationReady()) {
        pendingStableUtterances.enqueue(stable);
        console.info(
          `VOICE_STABLE_UTTERANCE_QUEUED ${JSON.stringify({
            call_id: input.callId,
            live_session_id: input.getDeps()?.liveSessionId ?? null,
            utterance_id: stable.utterance_id,
            revision: stable.revision,
            queue_depth: pendingStableUtterances.size(),
          })}`,
        );
        return { terminal: "queued", reason: "control_plane_not_ready" };
      }

      return interpretAndApplyStableUtterance(stable);
    },
  };
}
